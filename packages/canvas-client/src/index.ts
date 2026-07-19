import { CanvasClient, type CanvasClientConfig } from './client.js';
import { ContentExportsApi, ContentMigrationsApi } from './content-migrations.js';
import {
  AssignmentsApi,
  CoursesApi,
  DiscussionsApi,
  ModulesApi,
  PagesApi,
  QuizzesApi,
} from './domains.js';
import { FilesApi } from './uploads.js';

export * from './client.js';
export * from './content-migrations.js';
export * from './domains.js';
export * from './query.js';
export * from './types.js';
export { FilesApi, performUpload } from './uploads.js';

/** Everything in one place: `const canvas = createCanvas({ baseUrl, auth })`. */
export interface Canvas {
  client: CanvasClient;
  courses: CoursesApi;
  modules: ModulesApi;
  pages: PagesApi;
  assignments: AssignmentsApi;
  quizzes: QuizzesApi;
  discussions: DiscussionsApi;
  files: FilesApi;
  migrations: ContentMigrationsApi;
  exports: ContentExportsApi;
}

export function createCanvas(config: CanvasClientConfig): Canvas {
  const client = new CanvasClient(config);
  return {
    client,
    courses: new CoursesApi(client),
    modules: new ModulesApi(client),
    pages: new PagesApi(client),
    assignments: new AssignmentsApi(client),
    quizzes: new QuizzesApi(client),
    discussions: new DiscussionsApi(client),
    files: new FilesApi(client),
    migrations: new ContentMigrationsApi(client),
    exports: new ContentExportsApi(client),
  };
}
