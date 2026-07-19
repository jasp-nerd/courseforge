import { z } from 'zod';
import { READ, type ToolContext, type ToolDefinition, WRITE } from './types.js';

/** Granular building blocks: modules, pages, assignments, quizzes, discussions. Everything is created unpublished unless asked otherwise. */
export function structureTools({ canvas }: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'list_modules',
      description: 'List the modules of a Canvas course with their items counts and order.',
      inputSchema: { course_id: z.string() },
      annotations: READ,
      audience: 'shared',
      handler: ({ course_id }: { course_id: string }) => canvas.modules.list(course_id),
    },
    {
      name: 'list_module_items',
      description: 'List the items inside one module of a Canvas course.',
      inputSchema: { course_id: z.string(), module_id: z.string() },
      annotations: READ,
      audience: 'shared',
      handler: ({ course_id, module_id }: { course_id: string; module_id: string }) =>
        canvas.modules.listItems(course_id, module_id),
    },
    {
      name: 'create_module',
      description: 'Create a new (unpublished) module in a Canvas course.',
      inputSchema: {
        course_id: z.string(),
        name: z.string(),
        position: z.number().int().optional().describe('1-based position'),
      },
      annotations: WRITE,
      audience: 'educator',
      handler: ({ course_id, ...params }: { course_id: string; name: string }) =>
        canvas.modules.create(course_id, params),
    },
    {
      name: 'publish_module',
      description: 'Publish or unpublish a module.',
      inputSchema: {
        course_id: z.string(),
        module_id: z.string(),
        published: z.boolean(),
      },
      annotations: WRITE,
      audience: 'educator',
      handler: ({
        course_id,
        module_id,
        published,
      }: {
        course_id: string;
        module_id: string;
        published: boolean;
      }) => canvas.modules.update(course_id, module_id, { published }),
    },
    {
      name: 'add_module_item',
      description:
        'Add an existing page/assignment/quiz/discussion/file to a module, or add an external URL or text sub-header. Use content_id for Assignment/Quiz/Discussion/File, page_url for Page, external_url for ExternalUrl.',
      inputSchema: {
        course_id: z.string(),
        module_id: z.string(),
        type: z.enum([
          'Page',
          'Assignment',
          'Quiz',
          'Discussion',
          'File',
          'ExternalUrl',
          'SubHeader',
        ]),
        title: z.string().optional(),
        content_id: z.string().optional(),
        page_url: z.string().optional().describe('The page url slug (from create_page result)'),
        external_url: z.string().optional(),
        position: z.number().int().optional(),
        indent: z.number().int().optional(),
      },
      annotations: WRITE,
      audience: 'educator',
      handler: ({
        course_id,
        module_id,
        ...params
      }: {
        course_id: string;
        module_id: string;
        type: 'Page';
      }) => canvas.modules.createItem(course_id, module_id, params),
    },
    {
      name: 'create_page',
      description: 'Create a wiki page in a Canvas course (published by default — pages are safe).',
      inputSchema: {
        course_id: z.string(),
        title: z.string(),
        body_html: z.string().describe('Page body HTML'),
        published: z.boolean().optional().default(true),
        front_page: z.boolean().optional(),
      },
      annotations: WRITE,
      audience: 'educator',
      handler: ({
        course_id,
        body_html,
        ...params
      }: {
        course_id: string;
        title: string;
        body_html: string;
        published?: boolean;
      }) => canvas.pages.create(course_id, { ...params, body: body_html }),
    },
    {
      name: 'create_assignment',
      description:
        'Create an (unpublished) assignment: points, due date, submission types, optional assignment group.',
      inputSchema: {
        course_id: z.string(),
        name: z.string(),
        description_html: z.string().optional(),
        points_possible: z.number().optional(),
        due_at: z.string().optional().describe('ISO datetime'),
        submission_types: z
          .array(
            z.enum([
              'online_text_entry',
              'online_url',
              'online_upload',
              'media_recording',
              'none',
              'on_paper',
            ]),
          )
          .optional(),
        assignment_group_id: z.string().optional(),
        published: z.boolean().optional().default(false),
        peer_reviews: z.boolean().optional(),
      },
      annotations: WRITE,
      audience: 'educator',
      handler: ({
        course_id,
        description_html,
        ...params
      }: {
        course_id: string;
        name: string;
        description_html?: string;
      }) => canvas.assignments.create(course_id, { ...params, description: description_html }),
    },
    {
      name: 'create_assignment_group',
      description: 'Create an assignment group (for weighted grading).',
      inputSchema: {
        course_id: z.string(),
        name: z.string(),
        group_weight: z.number().min(0).max(100).optional(),
      },
      annotations: WRITE,
      audience: 'educator',
      handler: ({ course_id, ...params }: { course_id: string; name: string }) =>
        canvas.assignments.createGroup(course_id, params),
    },
    {
      name: 'create_quiz',
      description:
        'Create an (unpublished) Classic Quiz shell, then add questions with add_quiz_question. For whole quizzes with many questions, prefer build_course_from_spec or import_course_package.',
      inputSchema: {
        course_id: z.string(),
        title: z.string(),
        description_html: z.string().optional(),
        quiz_type: z.enum(['assignment', 'practice_quiz', 'graded_survey', 'survey']).optional(),
        due_at: z.string().optional(),
        allowed_attempts: z.number().int().optional(),
        shuffle_answers: z.boolean().optional(),
      },
      annotations: WRITE,
      audience: 'educator',
      handler: ({
        course_id,
        description_html,
        ...params
      }: {
        course_id: string;
        title: string;
        description_html?: string;
      }) => canvas.quizzes.create(course_id, { ...params, description: description_html }),
    },
    {
      name: 'add_quiz_question',
      description:
        'Add one question to a Classic Quiz. question_type is a Canvas type like multiple_choice_question, true_false_question, short_answer_question, essay_question. answers is Canvas answer objects, e.g. [{"answer_text":"4","answer_weight":100},{"answer_text":"5","answer_weight":0}].',
      inputSchema: {
        course_id: z.string(),
        quiz_id: z.string(),
        question_text: z.string(),
        question_type: z.string(),
        points_possible: z.number().optional(),
        answers: z.array(z.record(z.string(), z.unknown())).optional(),
      },
      annotations: WRITE,
      audience: 'educator',
      handler: ({
        course_id,
        quiz_id,
        ...params
      }: {
        course_id: string;
        quiz_id: string;
        question_text: string;
        question_type: string;
      }) => canvas.quizzes.createQuestion(course_id, quiz_id, params),
    },
    {
      name: 'create_discussion',
      description:
        'Create an (unpublished) discussion topic or announcement. Set is_announcement for announcements; set points_possible to make it graded.',
      inputSchema: {
        course_id: z.string(),
        title: z.string(),
        message_html: z.string(),
        threaded: z.boolean().optional().default(true),
        is_announcement: z.boolean().optional(),
        points_possible: z.number().optional(),
        due_at: z.string().optional(),
        published: z.boolean().optional().default(false),
      },
      annotations: WRITE,
      audience: 'educator',
      handler: ({
        course_id,
        message_html,
        threaded,
        points_possible,
        due_at,
        ...params
      }: {
        course_id: string;
        title: string;
        message_html: string;
        threaded?: boolean;
        points_possible?: number;
        due_at?: string;
      }) =>
        canvas.discussions.create(course_id, {
          ...params,
          message: message_html,
          discussion_type: threaded === false ? 'side_comment' : 'threaded',
          ...(points_possible
            ? { assignment: { points_possible, grading_type: 'points', due_at } }
            : {}),
        }),
    },
  ];
}
