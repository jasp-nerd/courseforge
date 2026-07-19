import type { CanvasClient } from './client.js';
import type { CanvasFile, CanvasId, FileUploadTarget } from './types.js';

/**
 * Canvas's 3-step file upload dance:
 *  1. POST to a Canvas endpoint declaring name+size → { upload_url, upload_params }
 *  2. POST multipart/form-data to upload_url: every upload_param first, `file` LAST
 *  3. Follow the confirmation (201 JSON, or a 3xx Location that must be called with auth)
 * Used both for course files and for content_migration pre_attachments.
 */
export async function performUpload(
  client: CanvasClient,
  target: FileUploadTarget,
  file: { name: string; bytes: Uint8Array; contentType?: string },
): Promise<unknown> {
  const form = new FormData();
  for (const [key, value] of Object.entries(target.upload_params ?? {})) {
    form.append(key, value);
  }
  const copy = new Uint8Array(file.bytes.length);
  copy.set(file.bytes);
  form.append(
    target.file_param ?? 'file',
    new Blob([copy.buffer], { type: file.contentType ?? 'application/octet-stream' }),
    file.name,
  );

  const fetchImpl = globalThis.fetch;
  const response = await fetchImpl(target.upload_url, {
    method: 'POST',
    body: form,
    redirect: 'manual',
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('Location');
    if (!location) throw new Error('upload redirect had no Location header');
    return client.get(location);
  }
  if (!response.ok) {
    throw new Error(`file upload failed with status ${response.status}`);
  }
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export class FilesApi {
  constructor(private readonly client: CanvasClient) {}

  /** Upload a file into a course's Files area. */
  async upload(
    courseId: CanvasId,
    file: { name: string; bytes: Uint8Array; contentType?: string; parentFolderPath?: string },
  ): Promise<CanvasFile> {
    const target = await this.client.post<FileUploadTarget>(`/courses/${courseId}/files`, {
      name: file.name,
      size: file.bytes.length,
      content_type: file.contentType,
      parent_folder_path: file.parentFolderPath ?? '/',
      on_duplicate: 'rename',
    });
    return (await performUpload(this.client, target, file)) as CanvasFile;
  }

  list(courseId: CanvasId): Promise<CanvasFile[]> {
    return this.client.paginate<CanvasFile>(`/courses/${courseId}/files`);
  }
}
