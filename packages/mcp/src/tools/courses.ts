import { z } from 'zod';
import { READ, type ToolContext, type ToolDefinition, WRITE } from './types.js';

export function courseTools({ canvas }: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'list_courses',
      description:
        'List the Canvas courses the authenticated user can see, with id, name, code, and workflow state.',
      inputSchema: {},
      annotations: READ,
      audience: 'shared',
      handler: async () => {
        const courses = await canvas.courses.list();
        return courses.map((c) => ({
          id: c.id,
          name: c.name,
          course_code: c.course_code,
          workflow_state: c.workflow_state,
        }));
      },
    },
    {
      name: 'get_course',
      description: 'Get one Canvas course including its syllabus body.',
      inputSchema: { course_id: z.string().describe('Canvas course id') },
      annotations: READ,
      audience: 'shared',
      handler: ({ course_id }: { course_id: string }) => canvas.courses.get(course_id),
    },
    {
      name: 'list_accounts',
      description:
        'List Canvas accounts the user can administer. Needed to pick an account_id before create_course.',
      inputSchema: {},
      annotations: READ,
      audience: 'educator',
      handler: () => canvas.courses.listAccounts(),
    },
    {
      name: 'create_course',
      description:
        'Create a new (unpublished) Canvas course in an account. Requires an account_id from list_accounts; teachers without account rights should create the course shell in the Canvas UI instead and then use the other tools.',
      inputSchema: {
        account_id: z.string().describe('Canvas account id to create the course under'),
        name: z.string().describe('Course name'),
        course_code: z.string().optional().describe('Short course code, e.g. CHEM-101'),
        default_view: z.enum(['modules', 'wiki', 'assignments', 'syllabus', 'feed']).optional(),
      },
      annotations: WRITE,
      audience: 'educator',
      handler: ({ account_id, ...params }: { account_id: string; name: string }) =>
        canvas.courses.create(account_id, params),
    },
    {
      name: 'update_syllabus',
      description: 'Set or replace the syllabus body (HTML) of a Canvas course.',
      inputSchema: {
        course_id: z.string(),
        syllabus_html: z.string().describe('Full syllabus HTML'),
      },
      annotations: WRITE,
      audience: 'educator',
      handler: ({ course_id, syllabus_html }: { course_id: string; syllabus_html: string }) =>
        canvas.courses.updateSyllabus(course_id, syllabus_html),
    },
  ];
}
