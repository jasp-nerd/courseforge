/** Minimal Canvas resource shapes — only the fields CourseForge reads. Ids are numbers with token auth, strings with cookie sessions. */

export type CanvasId = number | string;

export interface CanvasCourse {
  id: CanvasId;
  name: string;
  course_code: string;
  workflow_state: string;
  account_id?: CanvasId;
  default_view?: string;
  syllabus_body?: string | null;
  time_zone?: string;
  enrollments?: Array<{ type: string; role: string }>;
}

export interface CanvasFeatureFlag {
  feature: string;
  state?: string;
}

export interface CanvasAccount {
  id: CanvasId;
  name: string;
  workflow_state: string;
}

export interface CanvasModule {
  id: CanvasId;
  name: string;
  position: number;
  published?: boolean;
  items_count?: number;
}

export interface CanvasModuleItem {
  id: CanvasId;
  title: string;
  type: string;
  position: number;
  content_id?: CanvasId;
  page_url?: string;
  external_url?: string;
  published?: boolean;
}

export interface CanvasPage {
  page_id: CanvasId;
  url: string;
  title: string;
  body?: string;
  published: boolean;
  front_page: boolean;
}

export interface CanvasAssignment {
  id: CanvasId;
  name: string;
  description?: string | null;
  points_possible: number | null;
  due_at: string | null;
  unlock_at?: string | null;
  lock_at?: string | null;
  submission_types: string[];
  published: boolean;
  assignment_group_id?: CanvasId;
  grading_type?: string;
}

export interface CanvasAssignmentGroup {
  id: CanvasId;
  name: string;
  position: number;
  group_weight: number;
}

export interface CanvasQuiz {
  id: CanvasId;
  title: string;
  quiz_type: string;
  points_possible: number | null;
  question_count?: number;
  published: boolean;
  due_at?: string | null;
}

export interface CanvasDiscussion {
  id: CanvasId;
  title: string;
  message?: string;
  discussion_type?: string;
  published: boolean;
  is_announcement?: boolean;
}

export interface CanvasFile {
  id: CanvasId;
  display_name: string;
  filename: string;
  size: number;
  'content-type'?: string;
  url?: string;
}

export interface CanvasProgress {
  id: CanvasId;
  workflow_state: 'queued' | 'running' | 'completed' | 'failed';
  completion: number | null;
  message?: string | null;
}

export interface CanvasContentMigration {
  id: CanvasId;
  migration_type: string;
  workflow_state: string;
  progress_url?: string;
  pre_attachment?: {
    upload_url: string;
    upload_params: Record<string, string>;
    message?: string;
  };
  migration_issues_url?: string;
}

export interface CanvasMigrationIssue {
  id: CanvasId;
  issue_type: 'todo' | 'warning' | 'error';
  description: string;
  workflow_state: string;
  fix_issue_html_url?: string | null;
}

export interface CanvasMigrator {
  type: string;
  name: string;
  required_settings?: string[];
}

export interface CanvasContentExport {
  id: CanvasId;
  export_type: string;
  workflow_state: 'created' | 'exporting' | 'exported' | 'failed';
  progress_url?: string;
  attachment?: { url?: string; filename?: string; size?: number };
}

export interface FileUploadTarget {
  upload_url: string;
  upload_params: Record<string, string>;
  file_param?: string;
}
