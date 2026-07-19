import type { CanvasClient } from './client.js';
import type {
  CanvasContentExport,
  CanvasContentMigration,
  CanvasId,
  CanvasMigrationIssue,
  CanvasMigrator,
  CanvasProgress,
} from './types.js';
import { performUpload } from './uploads.js';

export interface ImportCartridgeOptions {
  filename?: string;
  /** Route quizzes into New Quizzes instead of Classic. */
  importQuizzesNext?: boolean;
  /** Shift dates on import. */
  dateShift?: { oldStartDate?: string; newStartDate?: string };
  /** Called after each progress poll with 0-100. */
  onProgress?: (completion: number, state: CanvasProgress['workflow_state']) => void;
  /** Poll interval in ms (default 2000). */
  pollIntervalMs?: number;
  /** Give up after this many polls (default 300 ≈ 10 minutes). */
  maxPolls?: number;
}

export interface ImportResult {
  migration: CanvasContentMigration;
  progress: CanvasProgress;
  issues: CanvasMigrationIssue[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The CourseForge flagship: push a .imscc straight into a Canvas course via
 * POST /courses/:id/content_migrations (migration_type=common_cartridge_importer),
 * upload the package, poll the progress URL, and surface migration issues.
 */
export class ContentMigrationsApi {
  constructor(private readonly client: CanvasClient) {}

  listMigrators(courseId: CanvasId): Promise<CanvasMigrator[]> {
    return this.client.get(`/courses/${courseId}/content_migrations/migrators`);
  }

  get(courseId: CanvasId, migrationId: CanvasId): Promise<CanvasContentMigration> {
    return this.client.get(`/courses/${courseId}/content_migrations/${migrationId}`);
  }

  listIssues(courseId: CanvasId, migrationId: CanvasId): Promise<CanvasMigrationIssue[]> {
    return this.client.paginate(
      `/courses/${courseId}/content_migrations/${migrationId}/migration_issues`,
    );
  }

  getProgress(progressUrl: string): Promise<CanvasProgress> {
    return this.client.get(progressUrl);
  }

  /** Step 1 only: declare the migration + pre_attachment. */
  create(
    courseId: CanvasId,
    params: {
      migration_type: string;
      pre_attachment?: { name: string; size: number };
      settings?: Record<string, unknown>;
      date_shift_options?: Record<string, unknown>;
    },
  ): Promise<CanvasContentMigration> {
    return this.client.post(`/courses/${courseId}/content_migrations`, params);
  }

  /** The whole dance: create → upload → poll → issues. */
  async importCartridge(
    courseId: CanvasId,
    bytes: Uint8Array,
    options: ImportCartridgeOptions = {},
  ): Promise<ImportResult> {
    const filename = options.filename ?? 'courseforge.imscc';
    const migration = await this.create(courseId, {
      migration_type: 'common_cartridge_importer',
      pre_attachment: { name: filename, size: bytes.length },
      ...(options.importQuizzesNext ? { settings: { import_quizzes_next: true } } : {}),
      ...(options.dateShift
        ? {
            date_shift_options: {
              shift_dates: true,
              old_start_date: options.dateShift.oldStartDate,
              new_start_date: options.dateShift.newStartDate,
            },
          }
        : {}),
    });

    if (!migration.pre_attachment?.upload_url) {
      throw new Error(
        `content migration did not return an upload URL${migration.pre_attachment?.message ? `: ${migration.pre_attachment.message}` : ''}`,
      );
    }
    await performUpload(this.client, migration.pre_attachment, { name: filename, bytes });

    const progress = await this.waitForCompletion(courseId, migration, options);
    const issues = await this.listIssues(courseId, migration.id).catch(() => []);
    return { migration: await this.get(courseId, migration.id), progress, issues };
  }

  private async waitForCompletion(
    courseId: CanvasId,
    migration: CanvasContentMigration,
    options: ImportCartridgeOptions,
  ): Promise<CanvasProgress> {
    const interval = options.pollIntervalMs ?? 2000;
    const maxPolls = options.maxPolls ?? 300;

    for (let i = 0; i < maxPolls; i++) {
      await sleep(interval);
      let progress: CanvasProgress;
      if (migration.progress_url) {
        progress = await this.getProgress(migration.progress_url);
      } else {
        const current = await this.get(courseId, migration.id);
        progress = {
          id: current.id,
          workflow_state:
            current.workflow_state === 'completed'
              ? 'completed'
              : current.workflow_state === 'failed'
                ? 'failed'
                : 'running',
          completion: null,
        };
      }
      options.onProgress?.(progress.completion ?? 0, progress.workflow_state);
      if (progress.workflow_state === 'completed' || progress.workflow_state === 'failed') {
        return progress;
      }
    }
    throw new Error(`import did not finish within ${maxPolls} polls`);
  }
}

export class ContentExportsApi {
  constructor(private readonly client: CanvasClient) {}

  create(
    courseId: CanvasId,
    exportType: 'common_cartridge' | 'qti' | 'zip' = 'common_cartridge',
  ): Promise<CanvasContentExport> {
    return this.client.post(`/courses/${courseId}/content_exports`, {
      export_type: exportType,
      skip_notifications: true,
    });
  }

  get(courseId: CanvasId, exportId: CanvasId): Promise<CanvasContentExport> {
    return this.client.get(`/courses/${courseId}/content_exports/${exportId}`);
  }

  /** Create an export and poll until the download URL is ready. */
  async exportAndWait(
    courseId: CanvasId,
    options: { pollIntervalMs?: number; maxPolls?: number } = {},
  ): Promise<CanvasContentExport> {
    const interval = options.pollIntervalMs ?? 2000;
    const maxPolls = options.maxPolls ?? 300;
    const created = await this.create(courseId);
    for (let i = 0; i < maxPolls; i++) {
      await sleep(interval);
      const current = await this.get(courseId, created.id);
      if (current.workflow_state === 'exported' || current.workflow_state === 'failed') {
        return current;
      }
    }
    throw new Error(`export did not finish within ${maxPolls} polls`);
  }
}
