import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CanvasApiError, CanvasClient, nextLink } from './client.js';
import { encodeQuery } from './query.js';

const BASE = 'https://canvas.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function client(overrides: Partial<ConstructorParameters<typeof CanvasClient>[0]> = {}) {
  return new CanvasClient({
    baseUrl: BASE,
    auth: { type: 'token', token: 'secret-token' },
    ...overrides,
  });
}

describe('CanvasClient core', () => {
  it('sends Authorization, User-Agent, and Accept headers', async () => {
    let seen: Record<string, string | null> = {};
    server.use(
      http.get(`${BASE}/api/v1/courses/1`, ({ request }) => {
        seen = {
          auth: request.headers.get('Authorization'),
          ua: request.headers.get('User-Agent'),
          accept: request.headers.get('Accept'),
        };
        return HttpResponse.json({ id: 1 });
      }),
    );
    await client().get('/courses/1');
    expect(seen.auth).toBe('Bearer secret-token');
    expect(seen.ua).toContain('courseforge');
    expect(seen.accept).toBe('application/json');
  });

  it('uses string-id Accept for cookie sessions and no Authorization', async () => {
    let seen: Record<string, string | null> = {};
    server.use(
      http.get(`${BASE}/api/v1/courses/1`, ({ request }) => {
        seen = {
          auth: request.headers.get('Authorization'),
          accept: request.headers.get('Accept'),
        };
        return HttpResponse.json({ id: '1' });
      }),
    );
    await client({ auth: { type: 'session' } }).get('/courses/1');
    expect(seen.auth).toBeNull();
    expect(seen.accept).toBe('application/json+canvas-string-ids');
  });

  it('refuses GET with a body before hitting the network', async () => {
    await expect(client().request('GET', '/courses', { body: { nope: true } })).rejects.toThrow(
      /GET requests with a body/,
    );
  });

  it('throws CanvasApiError with status and Canvas message', async () => {
    server.use(
      http.get(`${BASE}/api/v1/courses/99`, () =>
        HttpResponse.json(
          { errors: [{ message: 'The specified resource does not exist.' }] },
          { status: 404 },
        ),
      ),
    );
    const error = await client()
      .get('/courses/99')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CanvasApiError);
    expect((error as CanvasApiError).status).toBe(404);
    expect((error as CanvasApiError).message).toContain('does not exist');
  });

  it('retries 429 responses honoring Retry-After', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/v1/courses`, () => {
        calls += 1;
        if (calls < 3) {
          return new HttpResponse(null, { status: 429, headers: { 'Retry-After': '0.01' } });
        }
        return HttpResponse.json([{ id: 1 }]);
      }),
    );
    const result = await client().get<Array<{ id: number }>>('/courses');
    expect(calls).toBe(3);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('gives up after maxRetries 429s', async () => {
    server.use(
      http.get(
        `${BASE}/api/v1/courses`,
        () => new HttpResponse(null, { status: 429, headers: { 'Retry-After': '0.01' } }),
      ),
    );
    const error = await client({ maxRetries: 1 })
      .get('/courses')
      .catch((e: unknown) => e);
    expect((error as CanvasApiError).status).toBe(429);
  });

  it('follows rel="next" Link headers across pages with per_page=100', async () => {
    server.use(
      http.get(`${BASE}/api/v1/courses/1/modules`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('per_page')).toBe('100');
        return HttpResponse.json([{ id: 1 }, { id: 2 }], {
          headers: {
            Link: `<${BASE}/api/v1/courses/1/modules?page=2&per_page=100>; rel="next", <${BASE}/api/v1/courses/1/modules?page=1>; rel="first"`,
          },
        });
      }),
    );
    // Second page — MSW matches by path, so branch inside on the page param.
    server.resetHandlers(
      http.get(`${BASE}/api/v1/courses/1/modules`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        if (page === '2') return HttpResponse.json([{ id: 3 }]);
        return HttpResponse.json([{ id: 1 }, { id: 2 }], {
          headers: {
            Link: `<${BASE}/api/v1/courses/1/modules?page=2&per_page=100>; rel="next"`,
          },
        });
      }),
    );
    const items = await client().paginate<{ id: number }>('/courses/1/modules');
    expect(items.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('enforces the pagination page cap', async () => {
    server.use(
      http.get(`${BASE}/api/v1/loop`, () =>
        HttpResponse.json([{ id: 1 }], {
          headers: { Link: `<${BASE}/api/v1/loop?page=next>; rel="next"` },
        }),
      ),
    );
    await expect(client({ maxPaginationPages: 3 }).paginate('/loop')).rejects.toThrow(
      /exceeded 3 pages/,
    );
  });

  it('form-encodes repeated-key params', async () => {
    let body = '';
    server.use(
      http.post(`${BASE}/api/v1/courses/1/modules/2/whatever`, async ({ request }) => {
        body = await request.text();
        expect(request.headers.get('Content-Type')).toContain('application/x-www-form-urlencoded');
        return HttpResponse.json({ ok: true });
      }),
    );
    await client().request('POST', '/courses/1/modules/2/whatever', {
      form: { 'module[prerequisite_module_ids][]': [11, 12], 'module[name]': 'X' },
    });
    expect(body).toBe(
      'module%5Bprerequisite_module_ids%5D%5B%5D=11&module%5Bprerequisite_module_ids%5D%5B%5D=12&module%5Bname%5D=X',
    );
  });
});

describe('query encoding', () => {
  it('produces repeated bracket keys for arrays', () => {
    expect(encodeQuery({ include: ['a', 'b'], per_page: 100 })).toBe(
      '?include%5B%5D=a&include%5B%5D=b&per_page=100',
    );
  });

  it('skips undefined values and returns empty string when nothing remains', () => {
    expect(encodeQuery({ a: undefined })).toBe('');
    expect(encodeQuery(undefined)).toBe('');
  });
});

describe('nextLink', () => {
  it('extracts the rel=next URL', () => {
    expect(
      nextLink('<https://x/api/v1/c?page=2>; rel="next", <https://x/api/v1/c?page=9>; rel="last"'),
    ).toBe('https://x/api/v1/c?page=2');
    expect(nextLink('<https://x/api/v1/c?page=9>; rel="last"')).toBeUndefined();
    expect(nextLink(null)).toBeUndefined();
  });
});
