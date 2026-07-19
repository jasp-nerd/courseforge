import type { CanvasClient } from './client.js';
import type {
  CanvasAccount,
  CanvasAssignment,
  CanvasAssignmentGroup,
  CanvasCourse,
  CanvasDiscussion,
  CanvasId,
  CanvasModule,
  CanvasModuleItem,
  CanvasPage,
  CanvasQuiz,
} from './types.js';

/** Course-level CRUD. Note: creating a course requires an account id. */
export class CoursesApi {
  constructor(private readonly client: CanvasClient) {}

  listAccounts(): Promise<CanvasAccount[]> {
    return this.client.paginate<CanvasAccount>('/accounts');
  }

  list(params: { enrollment_type?: string } = {}): Promise<CanvasCourse[]> {
    return this.client.paginate<CanvasCourse>('/courses', {
      ...params,
      include: ['term'],
    });
  }

  get(courseId: CanvasId): Promise<CanvasCourse> {
    return this.client.get(`/courses/${courseId}`, { include: ['syllabus_body'] });
  }

  create(
    accountId: CanvasId,
    params: { name: string; course_code?: string; default_view?: string },
  ): Promise<CanvasCourse> {
    return this.client.post(`/accounts/${accountId}/courses`, { course: params });
  }

  update(courseId: CanvasId, params: Record<string, unknown>): Promise<CanvasCourse> {
    return this.client.put(`/courses/${courseId}`, { course: params });
  }

  updateSyllabus(courseId: CanvasId, syllabusHtml: string): Promise<CanvasCourse> {
    return this.update(courseId, { syllabus_body: syllabusHtml });
  }

  /** Names of feature flags enabled on a course (e.g. "new_quizzes_native_experience"). */
  listEnabledFeatures(courseId: CanvasId): Promise<string[]> {
    return this.client.get<string[]>(`/courses/${courseId}/features/enabled`);
  }
}

export class ModulesApi {
  constructor(private readonly client: CanvasClient) {}

  list(courseId: CanvasId): Promise<CanvasModule[]> {
    return this.client.paginate<CanvasModule>(`/courses/${courseId}/modules`);
  }

  listItems(courseId: CanvasId, moduleId: CanvasId): Promise<CanvasModuleItem[]> {
    return this.client.paginate<CanvasModuleItem>(`/courses/${courseId}/modules/${moduleId}/items`);
  }

  create(courseId: CanvasId, params: { name: string; position?: number }): Promise<CanvasModule> {
    return this.client.post(`/courses/${courseId}/modules`, { module: params });
  }

  update(
    courseId: CanvasId,
    moduleId: CanvasId,
    params: { name?: string; published?: boolean; position?: number },
  ): Promise<CanvasModule> {
    return this.client.put(`/courses/${courseId}/modules/${moduleId}`, { module: params });
  }

  createItem(
    courseId: CanvasId,
    moduleId: CanvasId,
    params: {
      title?: string;
      type:
        | 'Page'
        | 'Assignment'
        | 'Quiz'
        | 'Discussion'
        | 'File'
        | 'ExternalUrl'
        | 'SubHeader'
        | 'ExternalTool';
      content_id?: CanvasId;
      page_url?: string;
      external_url?: string;
      position?: number;
      indent?: number;
    },
  ): Promise<CanvasModuleItem> {
    return this.client.post(`/courses/${courseId}/modules/${moduleId}/items`, {
      module_item: params,
    });
  }
}

export class PagesApi {
  constructor(private readonly client: CanvasClient) {}

  list(courseId: CanvasId): Promise<CanvasPage[]> {
    return this.client.paginate<CanvasPage>(`/courses/${courseId}/pages`);
  }

  get(courseId: CanvasId, urlOrId: string): Promise<CanvasPage> {
    return this.client.get(`/courses/${courseId}/pages/${urlOrId}`);
  }

  create(
    courseId: CanvasId,
    params: { title: string; body: string; published?: boolean; front_page?: boolean },
  ): Promise<CanvasPage> {
    return this.client.post(`/courses/${courseId}/pages`, { wiki_page: params });
  }

  update(
    courseId: CanvasId,
    urlOrId: string,
    params: Record<string, unknown>,
  ): Promise<CanvasPage> {
    return this.client.put(`/courses/${courseId}/pages/${urlOrId}`, { wiki_page: params });
  }
}

export class AssignmentsApi {
  constructor(private readonly client: CanvasClient) {}

  list(courseId: CanvasId): Promise<CanvasAssignment[]> {
    return this.client.paginate<CanvasAssignment>(`/courses/${courseId}/assignments`);
  }

  create(
    courseId: CanvasId,
    params: {
      name: string;
      description?: string;
      points_possible?: number;
      due_at?: string;
      unlock_at?: string;
      lock_at?: string;
      submission_types?: string[];
      grading_type?: string;
      assignment_group_id?: CanvasId;
      published?: boolean;
      peer_reviews?: boolean;
    },
  ): Promise<CanvasAssignment> {
    return this.client.post(`/courses/${courseId}/assignments`, { assignment: params });
  }

  update(
    courseId: CanvasId,
    assignmentId: CanvasId,
    params: Record<string, unknown>,
  ): Promise<CanvasAssignment> {
    return this.client.put(`/courses/${courseId}/assignments/${assignmentId}`, {
      assignment: params,
    });
  }

  listGroups(courseId: CanvasId): Promise<CanvasAssignmentGroup[]> {
    return this.client.paginate<CanvasAssignmentGroup>(`/courses/${courseId}/assignment_groups`);
  }

  createGroup(
    courseId: CanvasId,
    params: { name: string; group_weight?: number; position?: number },
  ): Promise<CanvasAssignmentGroup> {
    return this.client.post(`/courses/${courseId}/assignment_groups`, params);
  }
}

export class QuizzesApi {
  constructor(private readonly client: CanvasClient) {}

  list(courseId: CanvasId): Promise<CanvasQuiz[]> {
    return this.client.paginate<CanvasQuiz>(`/courses/${courseId}/quizzes`);
  }

  create(
    courseId: CanvasId,
    params: {
      title: string;
      description?: string;
      quiz_type?: 'assignment' | 'practice_quiz' | 'graded_survey' | 'survey';
      published?: boolean;
      due_at?: string;
      allowed_attempts?: number;
      shuffle_answers?: boolean;
      one_question_at_a_time?: boolean;
    },
  ): Promise<CanvasQuiz> {
    return this.client.post(`/courses/${courseId}/quizzes`, { quiz: params });
  }

  createQuestion(
    courseId: CanvasId,
    quizId: CanvasId,
    params: {
      question_name?: string;
      question_text: string;
      question_type: string;
      points_possible?: number;
      answers?: Array<Record<string, unknown>>;
    },
  ): Promise<unknown> {
    return this.client.post(`/courses/${courseId}/quizzes/${quizId}/questions`, {
      question: params,
    });
  }
}

export class DiscussionsApi {
  constructor(private readonly client: CanvasClient) {}

  list(courseId: CanvasId, onlyAnnouncements = false): Promise<CanvasDiscussion[]> {
    return this.client.paginate<CanvasDiscussion>(`/courses/${courseId}/discussion_topics`, {
      only_announcements: onlyAnnouncements,
    });
  }

  create(
    courseId: CanvasId,
    params: {
      title: string;
      message: string;
      discussion_type?: 'side_comment' | 'threaded';
      published?: boolean;
      is_announcement?: boolean;
      assignment?: { points_possible?: number; grading_type?: string; due_at?: string };
    },
  ): Promise<CanvasDiscussion> {
    return this.client.post(`/courses/${courseId}/discussion_topics`, params);
  }
}
