import { encodeQuery, type QueryParams } from './query.js';

/**
 * Core Canvas REST client. Encodes the invariants Canvas's API requires:
 * - a User-Agent header on every request (Canvas rejects requests without one)
 * - never a body on GET (Canvas's CDN answers 403)
 * - RFC-5988 Link-header pagination with per_page=100
 * - 429 handling honoring Retry-After with exponential backoff
 * - a concurrency semaphore (Canvas throttles ~700 requests / 10 min / user)
 */

export interface TokenAuth {
  type: 'token';
  token: string;
}

/** Same-origin cookie session (browser extensions running on a Canvas page). */
export interface SessionAuth {
  type: 'session';
}

export interface CanvasClientConfig {
  /** e.g. "https://canvas.instructure.com" — no trailing /api/v1. */
  baseUrl: string;
  auth: TokenAuth | SessionAuth;
  userAgent?: string;
  maxConcurrent?: number;
  maxRetries?: number;
  maxPaginationPages?: number;
  fetch?: typeof globalThis.fetch;
}

export class CanvasApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly body?: unknown;

  constructor(status: number, endpoint: string, message: string, body?: unknown) {
    super(`Canvas API ${status} on ${endpoint}: ${message}`);
    this.name = 'CanvasApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.body = body;
  }
}

export interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  /** Send as application/x-www-form-urlencoded (Canvas's repeated-key params). */
  form?: Record<string, string | number | boolean | Array<string | number>>;
  headers?: Record<string, string>;
}

class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly limit: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active += 1;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active += 1;
    return () => this.release();
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class CanvasClient {
  readonly baseUrl: string;
  private readonly config: Required<
    Pick<CanvasClientConfig, 'userAgent' | 'maxRetries' | 'maxPaginationPages'>
  > &
    CanvasClientConfig;
  private readonly semaphore: Semaphore;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(config: CanvasClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.config = {
      userAgent: 'courseforge/0.1 (+https://github.com/jasp-nerd/courseforge)',
      maxRetries: 3,
      maxPaginationPages: 1000,
      ...config,
    };
    this.semaphore = new Semaphore(config.maxConcurrent ?? 5);
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Perform a raw API request against /api/v1. Returns parsed JSON (or undefined for 204). */
  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.requestRaw(method, path, options);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async requestRaw(method: string, path: string, options: RequestOptions = {}): Promise<Response> {
    if (method === 'GET' && (options.body !== undefined || options.form !== undefined)) {
      throw new Error(`GET ${path}: Canvas rejects GET requests with a body (CDN 403)`);
    }

    const url = path.startsWith('http')
      ? `${path}${encodeQuery(options.query, path.includes('?'))}`
      : `${this.baseUrl}/api/v1${path}${encodeQuery(options.query, path.includes('?'))}`;

    const headers: Record<string, string> = {
      'User-Agent': this.config.userAgent,
      Accept: 'application/json',
      ...options.headers,
    };
    if (this.config.auth.type === 'token') {
      headers.Authorization = `Bearer ${this.config.auth.token}`;
    } else {
      // Cookie sessions get string ids to avoid JS precision loss on Canvas's bigints.
      headers.Accept = 'application/json+canvas-string-ids';
    }

    let body: string | undefined;
    if (options.form !== undefined) {
      const form = new URLSearchParams();
      for (const [key, value] of Object.entries(options.form)) {
        if (Array.isArray(value)) {
          for (const entry of value) form.append(key, String(entry));
        } else {
          form.append(key, String(value));
        }
      }
      body = form.toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
    }

    const release = await this.semaphore.acquire();
    try {
      let attempt = 0;
      for (;;) {
        const response = await this.fetchImpl(url, {
          method,
          headers,
          body,
          ...(this.config.auth.type === 'session' ? { credentials: 'include' as const } : {}),
        });

        if (response.status === 429 && attempt < this.config.maxRetries) {
          attempt += 1;
          const retryAfter = Number(response.headers.get('Retry-After'));
          const delay =
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500;
          await sleep(delay);
          continue;
        }

        if (!response.ok) {
          let errorBody: unknown;
          let message = response.statusText || 'request failed';
          try {
            errorBody = await response.json();
            const errors = (errorBody as { errors?: Array<{ message?: string }> }).errors;
            if (errors?.[0]?.message) message = errors[0].message;
          } catch {
            // non-JSON error body
          }
          throw new CanvasApiError(response.status, path, message, errorBody);
        }
        return response;
      }
    } finally {
      release();
    }
  }

  get<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>('GET', path, { query });
  }

  post<T>(path: string, body?: unknown, query?: QueryParams): Promise<T> {
    return this.request<T>('POST', path, { body, query });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, { body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  /** Follow rel="next" Link headers until exhausted (per_page=100, hard page cap). */
  async paginate<T>(path: string, query: QueryParams = {}): Promise<T[]> {
    const results: T[] = [];
    let url: string | undefined = path;
    let currentQuery: QueryParams | undefined = { per_page: 100, ...query };
    let pages = 0;

    while (url) {
      pages += 1;
      if (pages > this.config.maxPaginationPages) {
        throw new Error(`pagination exceeded ${this.config.maxPaginationPages} pages on ${path}`);
      }
      const response: Response = await this.requestRaw('GET', url, { query: currentQuery });
      const page = (await response.json()) as T[];
      results.push(...page);
      url = nextLink(response.headers.get('Link'));
      currentQuery = undefined; // the next-link already carries the query string
    }
    return results;
  }
}

/** Parse an RFC-5988 Link header and return the rel="next" URL, if any. */
export function nextLink(header: string | null): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (match) return match[1];
  }
  return undefined;
}
