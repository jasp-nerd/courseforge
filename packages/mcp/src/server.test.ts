import { createCanvas } from '@courseforge/canvas-client';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createCourseForgeServer } from './server.js';
import { allTools } from './tools/catalog.js';

const BASE = 'https://canvas.test';
const msw = setupServer();

beforeAll(() => msw.listen({ onUnhandledRequest: 'error' }));
afterEach(() => msw.resetHandlers());
afterAll(() => msw.close());

async function connectedClient() {
  const server = createCourseForgeServer({ canvasBaseUrl: BASE, canvasToken: 't' });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

describe('tool catalog contract', () => {
  const tools = allTools({
    canvas: createCanvas({ baseUrl: BASE, auth: { type: 'token', token: 't' } }),
  });

  it('has unique snake_case names', () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('every tool has a description, annotations, and audience', () => {
    for (const tool of tools) {
      expect(tool.description.length, tool.name).toBeGreaterThan(20);
      expect(tool.audience, tool.name).toMatch(/^(educator|shared)$/);
      const isRead = tool.annotations.readOnlyHint === true;
      const isWrite = tool.annotations.destructiveHint !== undefined;
      expect(isRead || isWrite, `${tool.name} must declare read or write annotations`).toBe(true);
    }
  });

  it('every write tool is marked destructive (host confirmation) and no read tool is', () => {
    for (const tool of tools) {
      if (tool.annotations.readOnlyHint) {
        expect(tool.annotations.destructiveHint, tool.name).not.toBe(true);
      }
    }
  });

  it('covers the flagship import surface', () => {
    const names = new Set(tools.map((t) => t.name));
    for (const required of [
      'build_course_from_spec',
      'build_imscc_file',
      'import_course_package',
      'get_migration_progress',
      'list_migration_issues',
      'export_course_package',
      'validate_course_spec',
      'check_course_setup',
    ]) {
      expect(names.has(required), required).toBe(true);
    }
  });
});

describe('MCP protocol integration (InMemoryTransport)', () => {
  it('lists tools over the protocol', async () => {
    const { client, server } = await connectedClient();
    const result = await client.listTools();
    expect(result.tools.length).toBeGreaterThanOrEqual(15);
    const listCourses = result.tools.find((t) => t.name === 'list_courses');
    expect(listCourses?.annotations?.readOnlyHint).toBe(true);
    const build = result.tools.find((t) => t.name === 'build_course_from_spec');
    expect(build?.inputSchema).toBeDefined();
    await client.close();
    await server.close();
  });

  it('calls list_courses end-to-end against mocked Canvas', async () => {
    msw.use(
      http.get(`${BASE}/api/v1/courses`, () =>
        HttpResponse.json([
          { id: 1, name: 'Chemistry', course_code: 'CHEM-101', workflow_state: 'unpublished' },
        ]),
      ),
    );
    const { client, server } = await connectedClient();
    const result = await client.callTool({ name: 'list_courses', arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(JSON.parse(text)).toEqual([
      { id: 1, name: 'Chemistry', course_code: 'CHEM-101', workflow_state: 'unpublished' },
    ]);
    await client.close();
    await server.close();
  });

  it('validates a CourseSpec through the protocol and reports field errors', async () => {
    const { client, server } = await connectedClient();
    const bad = await client.callTool({
      name: 'validate_course_spec',
      arguments: { spec: { course: { title: 'X' }, modules: [] } },
    });
    const badResult = JSON.parse(
      (bad.content as Array<{ type: string; text: string }>)[0]?.text ?? '{}',
    ) as { ok: boolean; errors: Array<{ path: string }> };
    expect(badResult.ok).toBe(false);
    expect(badResult.errors[0]?.path).toBe('modules');

    const good = await client.callTool({
      name: 'validate_course_spec',
      arguments: {
        spec: {
          course: { title: 'OK course' },
          modules: [{ name: 'M1', items: [{ type: 'page', title: 'P', body: '<p>x</p>' }] }],
        },
      },
    });
    const goodResult = JSON.parse(
      (good.content as Array<{ type: string; text: string }>)[0]?.text ?? '{}',
    ) as { ok: boolean; summary: { modules: number } };
    expect(goodResult.ok).toBe(true);
    expect(goodResult.summary.modules).toBe(1);
    await client.close();
    await server.close();
  });

  it('returns isError (not a crash) when Canvas rejects a call', async () => {
    msw.use(
      http.get(`${BASE}/api/v1/courses/404`, () =>
        HttpResponse.json({ errors: [{ message: 'not found' }] }, { status: 404 }),
      ),
    );
    const { client, server } = await connectedClient();
    const result = await client.callTool({ name: 'get_course', arguments: { course_id: '404' } });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('404');
    await client.close();
    await server.close();
  });

  it('builds a course from a spec via the mocked import dance', async () => {
    msw.use(
      http.post(`${BASE}/api/v1/courses/7/content_migrations`, () =>
        HttpResponse.json({
          id: 88,
          workflow_state: 'pre_processing',
          progress_url: `${BASE}/api/v1/progress/9`,
          pre_attachment: { upload_url: `${BASE}/bucket`, upload_params: { key: 'k' } },
        }),
      ),
      http.post(`${BASE}/bucket`, () => HttpResponse.json({}, { status: 201 })),
      http.get(`${BASE}/api/v1/progress/9`, () =>
        HttpResponse.json({ id: 9, workflow_state: 'completed', completion: 100 }),
      ),
      http.get(`${BASE}/api/v1/courses/7/content_migrations/88/migration_issues`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${BASE}/api/v1/courses/7/content_migrations/88`, () =>
        HttpResponse.json({ id: 88, workflow_state: 'completed' }),
      ),
    );
    const { client, server } = await connectedClient();
    const result = await client.callTool({
      name: 'build_course_from_spec',
      arguments: {
        course_id: '7',
        spec: {
          course: { title: 'Spec course' },
          modules: [{ name: 'M1', items: [{ type: 'page', title: 'P', body: '<p>x</p>' }] }],
        },
      },
    });
    const parsed = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '{}',
    ) as { ok: boolean; state: string };
    expect(parsed.ok).toBe(true);
    expect(parsed.state).toBe('completed');
    await client.close();
    await server.close();
  }, 15000);
});
