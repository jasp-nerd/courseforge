import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createCanvas } from './index.js';

const BASE = 'https://canvas.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function canvas() {
  return createCanvas({ baseUrl: BASE, auth: { type: 'token', token: 't' } });
}

describe('importCartridge — the 4-step content_migrations dance', () => {
  it('creates the migration, uploads the package, polls progress, and returns issues', async () => {
    const uploaded: { params?: Record<string, string>; fileLast?: boolean; filename?: string } = {};
    let polls = 0;

    server.use(
      http.post(`${BASE}/api/v1/courses/42/content_migrations`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.migration_type).toBe('common_cartridge_importer');
        expect(body.pre_attachment).toEqual({ name: 'demo.imscc', size: 4 });
        expect(body.settings).toEqual({ import_quizzes_next: true });
        return HttpResponse.json({
          id: 777,
          migration_type: 'common_cartridge_importer',
          workflow_state: 'pre_processing',
          progress_url: `${BASE}/api/v1/progress/555`,
          pre_attachment: {
            upload_url: `${BASE}/upload-bucket`,
            upload_params: { key: 'abc', signature: 'sig' },
          },
        });
      }),
      http.post(`${BASE}/upload-bucket`, async ({ request }) => {
        const form = await request.formData();
        const entries = [...form.entries()];
        uploaded.params = Object.fromEntries(
          entries.filter(([, v]) => typeof v === 'string') as Array<[string, string]>,
        );
        uploaded.fileLast = entries.at(-1)?.[0] === 'file';
        const file = form.get('file') as File;
        uploaded.filename = file.name;
        return HttpResponse.json({ id: 999 }, { status: 201 });
      }),
      http.get(`${BASE}/api/v1/progress/555`, () => {
        polls += 1;
        return HttpResponse.json(
          polls < 2
            ? { id: 555, workflow_state: 'running', completion: 50 }
            : { id: 555, workflow_state: 'completed', completion: 100 },
        );
      }),
      http.get(`${BASE}/api/v1/courses/42/content_migrations/777/migration_issues`, () =>
        HttpResponse.json([
          {
            id: 1,
            issue_type: 'warning',
            description: 'External tool not configured',
            workflow_state: 'active',
          },
        ]),
      ),
      http.get(`${BASE}/api/v1/courses/42/content_migrations/777`, () =>
        HttpResponse.json({
          id: 777,
          migration_type: 'common_cartridge_importer',
          workflow_state: 'completed',
        }),
      ),
    );

    const seenProgress: number[] = [];
    const result = await canvas().migrations.importCartridge(42, new Uint8Array([1, 2, 3, 4]), {
      filename: 'demo.imscc',
      importQuizzesNext: true,
      pollIntervalMs: 1,
      onProgress: (completion) => seenProgress.push(completion),
    });

    expect(uploaded.params).toEqual({ key: 'abc', signature: 'sig' });
    expect(uploaded.fileLast).toBe(true);
    expect(uploaded.filename).toBe('demo.imscc');
    expect(seenProgress).toEqual([50, 100]);
    expect(result.progress.workflow_state).toBe('completed');
    expect(result.migration.workflow_state).toBe('completed');
    expect(result.issues[0]?.issue_type).toBe('warning');
  });

  it('surfaces a quota message when Canvas refuses the pre_attachment', async () => {
    server.use(
      http.post(`${BASE}/api/v1/courses/42/content_migrations`, () =>
        HttpResponse.json({
          id: 778,
          workflow_state: 'pre_processing',
          pre_attachment: { message: 'file size exceeds quota', upload_url: '', upload_params: {} },
        }),
      ),
    );
    await expect(
      canvas().migrations.importCartridge(42, new Uint8Array([1]), { pollIntervalMs: 1 }),
    ).rejects.toThrow(/exceeds quota/);
  });

  it('reports failed imports', async () => {
    server.use(
      http.post(`${BASE}/api/v1/courses/42/content_migrations`, () =>
        HttpResponse.json({
          id: 779,
          workflow_state: 'pre_processing',
          progress_url: `${BASE}/api/v1/progress/556`,
          pre_attachment: { upload_url: `${BASE}/upload-bucket`, upload_params: {} },
        }),
      ),
      http.post(`${BASE}/upload-bucket`, () => HttpResponse.json({}, { status: 201 })),
      http.get(`${BASE}/api/v1/progress/556`, () =>
        HttpResponse.json({
          id: 556,
          workflow_state: 'failed',
          completion: 10,
          message: 'bad manifest',
        }),
      ),
      http.get(`${BASE}/api/v1/courses/42/content_migrations/779/migration_issues`, () =>
        HttpResponse.json([
          { id: 2, issue_type: 'error', description: 'Invalid manifest', workflow_state: 'active' },
        ]),
      ),
      http.get(`${BASE}/api/v1/courses/42/content_migrations/779`, () =>
        HttpResponse.json({ id: 779, workflow_state: 'failed' }),
      ),
    );
    const result = await canvas().migrations.importCartridge(42, new Uint8Array([1]), {
      pollIntervalMs: 1,
    });
    expect(result.progress.workflow_state).toBe('failed');
    expect(result.issues[0]?.issue_type).toBe('error');
  });
});

describe('file upload (3-step dance)', () => {
  it('follows a 3xx confirmation with client auth', async () => {
    server.use(
      http.post(`${BASE}/api/v1/courses/42/files`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.name).toBe('notes.txt');
        expect(body.size).toBe(5);
        return HttpResponse.json({
          upload_url: `${BASE}/storage`,
          upload_params: { key: 'k' },
        });
      }),
      http.post(
        `${BASE}/storage`,
        () =>
          new HttpResponse(null, {
            status: 303,
            headers: { Location: `${BASE}/api/v1/files/12345/confirm` },
          }),
      ),
      http.get(`${BASE}/api/v1/files/12345/confirm`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer t');
        return HttpResponse.json({
          id: 12345,
          display_name: 'notes.txt',
          filename: 'notes.txt',
          size: 5,
        });
      }),
    );
    const file = await canvas().files.upload(42, {
      name: 'notes.txt',
      bytes: new Uint8Array([104, 101, 108, 108, 111]),
    });
    expect(file.id).toBe(12345);
  });
});

describe('content exports', () => {
  it('polls until the export is ready', async () => {
    let polls = 0;
    server.use(
      http.post(`${BASE}/api/v1/courses/42/content_exports`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.export_type).toBe('common_cartridge');
        return HttpResponse.json({
          id: 5,
          export_type: 'common_cartridge',
          workflow_state: 'created',
        });
      }),
      http.get(`${BASE}/api/v1/courses/42/content_exports/5`, () => {
        polls += 1;
        return HttpResponse.json(
          polls < 2
            ? { id: 5, export_type: 'common_cartridge', workflow_state: 'exporting' }
            : {
                id: 5,
                export_type: 'common_cartridge',
                workflow_state: 'exported',
                attachment: { url: `${BASE}/files/export.imscc`, filename: 'export.imscc' },
              },
        );
      }),
    );
    const result = await canvas().exports.exportAndWait(42, { pollIntervalMs: 1 });
    expect(result.workflow_state).toBe('exported');
    expect(result.attachment?.url).toContain('export.imscc');
  });
});
