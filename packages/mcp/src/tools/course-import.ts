import { readFile, writeFile } from 'node:fs/promises';
import { buildCartridge, validateCartridge } from '@courseforge/imscc';
import { courseSpecSchema } from '@courseforge/shared';
import { z } from 'zod';
import { buildCourseViaApi } from './build-live.js';
import { READ, type ToolContext, type ToolDefinition, WRITE } from './types.js';

/**
 * CourseForge's flagship tools: the .imscc import/export round-trip that no
 * other Canvas MCP ships. Long-running jobs follow create → poll → report.
 */
export function courseImportTools({ canvas }: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'validate_course_spec',
      description:
        'Validate a CourseSpec JSON (the CourseForge course format: course + assignmentGroups + modules with page/assignment/quiz/discussion/link/file/header items) without touching Canvas. Returns ok or precise field errors. Always run this before build_course_from_spec or build_imscc_file.',
      inputSchema: {
        spec: z.record(z.string(), z.unknown()).describe('The CourseSpec object'),
      },
      annotations: { readOnlyHint: true },
      audience: 'shared',
      handler: ({ spec }: { spec: unknown }) => {
        const result = courseSpecSchema.safeParse(spec);
        if (result.success) {
          const modules = result.data.modules;
          return Promise.resolve({
            ok: true,
            summary: {
              title: result.data.course.title,
              modules: modules.length,
              items: modules.reduce((n, m) => n + m.items.length, 0),
            },
          });
        }
        return Promise.resolve({
          ok: false,
          errors: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      },
    },
    {
      name: 'build_imscc_file',
      description:
        'Build a Canvas-ready .imscc course package file from a CourseSpec and save it to disk. The teacher can upload it via Canvas → Settings → Import Course Content → Common Cartridge, or you can push it with import_course_package. Returns the file path, size, and validation report.',
      inputSchema: {
        spec: z.record(z.string(), z.unknown()).describe('The CourseSpec object'),
        output_path: z.string().describe('Where to write the .imscc file'),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
      audience: 'shared',
      handler: async ({ spec, output_path }: { spec: unknown; output_path: string }) => {
        const result = buildCartridge(spec);
        await writeFile(output_path, result.bytes);
        const validation = validateCartridge(result.bytes);
        return {
          path: output_path,
          bytes: result.bytes.length,
          validation,
          next_steps:
            'Upload via Canvas → Settings → Import Course Content → "Common Cartridge 1.x Package", or call import_course_package with this file.',
        };
      },
    },
    {
      name: 'import_course_package',
      description:
        'Import a .imscc / Common Cartridge package into an existing Canvas course via the content_migrations API (declare → upload → poll → issues). Content arrives unpublished. Pass wait=false to return immediately and poll with get_migration_progress.',
      inputSchema: {
        course_id: z.string(),
        imscc_path: z.string().describe('Path to the .imscc file on disk'),
        import_quizzes_next: z
          .boolean()
          .optional()
          .describe('Route quizzes into New Quizzes instead of Classic Quizzes'),
        wait: z.boolean().optional().default(true).describe('Poll until the import finishes'),
      },
      annotations: WRITE,
      audience: 'educator',
      handler: async ({
        course_id,
        imscc_path,
        import_quizzes_next,
        wait,
      }: {
        course_id: string;
        imscc_path: string;
        import_quizzes_next?: boolean;
        wait?: boolean;
      }) => {
        const bytes = new Uint8Array(await readFile(imscc_path));
        const filename = imscc_path.split('/').pop() ?? 'course.imscc';

        if (wait === false) {
          const migration = await canvas.migrations.create(course_id, {
            migration_type: 'common_cartridge_importer',
            pre_attachment: { name: filename, size: bytes.length },
            ...(import_quizzes_next ? { settings: { import_quizzes_next: true } } : {}),
          });
          if (!migration.pre_attachment?.upload_url) {
            throw new Error(
              `Canvas refused the upload${migration.pre_attachment?.message ? `: ${migration.pre_attachment.message}` : ''}`,
            );
          }
          const { performUpload } = await import('@courseforge/canvas-client');
          await performUpload(canvas.client, migration.pre_attachment, { name: filename, bytes });
          return {
            migration_id: migration.id,
            progress_url: migration.progress_url,
            note: 'Import started. Poll with get_migration_progress, then list_migration_issues.',
          };
        }

        const result = await canvas.migrations.importCartridge(course_id, bytes, {
          filename,
          importQuizzesNext: import_quizzes_next,
        });
        return {
          migration_id: result.migration.id,
          state: result.progress.workflow_state,
          issues: result.issues,
        };
      },
    },
    {
      name: 'get_migration_progress',
      description:
        'Check the progress of a running content migration (course import) by progress_url or migration id.',
      inputSchema: {
        course_id: z.string(),
        migration_id: z.string(),
      },
      annotations: READ,
      audience: 'educator',
      handler: async ({ course_id, migration_id }: { course_id: string; migration_id: string }) => {
        const migration = await canvas.migrations.get(course_id, migration_id);
        if (migration.progress_url) {
          const progress = await canvas.migrations.getProgress(migration.progress_url);
          return { workflow_state: progress.workflow_state, completion: progress.completion };
        }
        return { workflow_state: migration.workflow_state, completion: null };
      },
    },
    {
      name: 'list_migration_issues',
      description:
        'List warnings/errors Canvas raised while importing a course package (broken links, unsupported content).',
      inputSchema: { course_id: z.string(), migration_id: z.string() },
      annotations: READ,
      audience: 'educator',
      handler: ({ course_id, migration_id }: { course_id: string; migration_id: string }) =>
        canvas.migrations.listIssues(course_id, migration_id),
    },
    {
      name: 'build_course_from_spec',
      description:
        'THE one-shot course builder: turn a validated CourseSpec into real content inside an existing Canvas course. mode="import" (default, recommended) packages the spec as a Canvas cartridge and imports it — fast, atomic, supports quizzes with all question types and files. mode="api" creates items one by one via the REST API — use when file uploads are restricted. Everything arrives unpublished for teacher review.',
      inputSchema: {
        course_id: z.string().describe('Existing Canvas course to build into'),
        spec: z.record(z.string(), z.unknown()).describe('The CourseSpec object'),
        mode: z.enum(['import', 'api']).optional().default('import'),
      },
      annotations: WRITE,
      audience: 'educator',
      handler: async ({
        course_id,
        spec,
        mode,
      }: {
        course_id: string;
        spec: unknown;
        mode?: 'import' | 'api';
      }) => {
        const parsed = courseSpecSchema.parse(spec);
        if (mode === 'api') {
          return buildCourseViaApi(canvas, course_id, parsed);
        }
        const built = buildCartridge(parsed);
        const validation = validateCartridge(built.bytes);
        if (!validation.valid) {
          return { ok: false, stage: 'build', validation };
        }
        const result = await canvas.migrations.importCartridge(course_id, built.bytes, {
          filename: built.filename,
        });
        return {
          ok: result.progress.workflow_state === 'completed',
          migration_id: result.migration.id,
          state: result.progress.workflow_state,
          issues: result.issues,
          note: 'Content is unpublished — review in Canvas, then publish modules.',
        };
      },
    },
    {
      name: 'export_course_package',
      description:
        'Export an existing Canvas course as a .imscc Common Cartridge (for backup, remixing with the imscc-editor skill, or importing elsewhere). Polls until Canvas finishes, then saves the file if output_path is given.',
      inputSchema: {
        course_id: z.string(),
        output_path: z
          .string()
          .optional()
          .describe('Where to save the .imscc; omit to just get the download URL'),
      },
      annotations: READ,
      audience: 'educator',
      handler: async ({ course_id, output_path }: { course_id: string; output_path?: string }) => {
        const exported = await canvas.exports.exportAndWait(course_id);
        if (exported.workflow_state !== 'exported' || !exported.attachment?.url) {
          return { ok: false, state: exported.workflow_state };
        }
        if (!output_path) {
          return {
            ok: true,
            download_url: exported.attachment.url,
            note: 'URL expires in ~1 hour.',
          };
        }
        const response = await fetch(exported.attachment.url);
        if (!response.ok) throw new Error(`download failed with status ${response.status}`);
        await writeFile(output_path, new Uint8Array(await response.arrayBuffer()));
        return { ok: true, path: output_path };
      },
    },
  ];
}
