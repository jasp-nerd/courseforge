import { z } from 'zod';

/**
 * CourseSpec is CourseForge's lingua franca: a plain-JSON description of a
 * Canvas course that agents generate from a syllabus, the IMSCC builder
 * packages into a cartridge, and the MCP server can build live via the API.
 */

const canvasDate = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
    'expected ISO datetime like 2026-09-01T23:59:00',
  )
  .describe('ISO local datetime, e.g. 2026-09-01T23:59:00');

export const gradingTypeSchema = z.enum([
  'points',
  'percent',
  'pass_fail',
  'letter_grade',
  'gpa_scale',
  'not_graded',
]);

export const submissionTypeSchema = z.enum([
  'online_text_entry',
  'online_url',
  'online_upload',
  'media_recording',
  'none',
  'on_paper',
  'discussion_topic',
  'online_quiz',
  'external_tool',
]);

// ---------------------------------------------------------------------------
// Quiz questions (QTI 1.2 compatible subset — the types Canvas understands)
// ---------------------------------------------------------------------------

const questionBase = {
  text: z.string().describe('Question text (HTML allowed)'),
  points: z.number().nonnegative().default(1),
};

export const questionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('multiple_choice'),
    ...questionBase,
    answers: z
      .array(z.object({ text: z.string(), correct: z.boolean().default(false) }))
      .min(2)
      .refine((a) => a.filter((x) => x.correct).length === 1, {
        message: 'multiple_choice needs exactly one correct answer',
      }),
  }),
  z.object({
    type: z.literal('multiple_answers'),
    ...questionBase,
    answers: z
      .array(z.object({ text: z.string(), correct: z.boolean().default(false) }))
      .min(2)
      .refine((a) => a.some((x) => x.correct), {
        message: 'multiple_answers needs at least one correct answer',
      }),
  }),
  z.object({
    type: z.literal('true_false'),
    ...questionBase,
    correct: z.boolean().describe('Whether "True" is the correct answer'),
  }),
  z.object({
    type: z.literal('short_answer'),
    ...questionBase,
    acceptedAnswers: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal('essay'),
    ...questionBase,
  }),
  z.object({
    type: z.literal('numerical'),
    ...questionBase,
    answer: z.number(),
    tolerance: z.number().nonnegative().default(0),
  }),
  z.object({
    type: z.literal('matching'),
    ...questionBase,
    pairs: z.array(z.object({ left: z.string(), right: z.string() })).min(2),
  }),
  z.object({
    type: z.literal('text_only'),
    text: z.string().describe('Informational text block (HTML allowed), not graded'),
  }),
]);

export type Question = z.infer<typeof questionSchema>;

// ---------------------------------------------------------------------------
// Module items
// ---------------------------------------------------------------------------

export const pageItemSchema = z.object({
  type: z.literal('page'),
  title: z.string().min(1),
  body: z.string().describe('Page body HTML'),
  published: z.boolean().default(true),
});

export const assignmentItemSchema = z.object({
  type: z.literal('assignment'),
  title: z.string().min(1),
  body: z.string().default('').describe('Assignment description HTML'),
  points: z.number().nonnegative().default(0),
  gradingType: gradingTypeSchema.default('points'),
  submissionTypes: z.array(submissionTypeSchema).min(1).default(['online_text_entry']),
  dueAt: canvasDate.optional(),
  unlockAt: canvasDate.optional(),
  lockAt: canvasDate.optional(),
  assignmentGroup: z
    .string()
    .optional()
    .describe('Name of an assignment group defined in assignmentGroups'),
  peerReviews: z.boolean().default(false),
  published: z.boolean().default(false),
});

export const quizItemSchema = z.object({
  type: z.literal('quiz'),
  title: z.string().min(1),
  description: z.string().default(''),
  quizType: z
    .enum(['assignment', 'practice_quiz', 'graded_survey', 'survey'])
    .default('assignment'),
  questions: z.array(questionSchema).min(1),
  shuffleAnswers: z.boolean().default(false),
  allowedAttempts: z.number().int().default(1).describe('-1 for unlimited'),
  scoringPolicy: z.enum(['keep_highest', 'keep_latest']).default('keep_highest'),
  oneQuestionAtATime: z.boolean().default(false),
  dueAt: canvasDate.optional(),
  assignmentGroup: z.string().optional(),
  published: z.boolean().default(false),
});

export const discussionItemSchema = z.object({
  type: z.literal('discussion'),
  title: z.string().min(1),
  body: z.string().describe('Discussion prompt HTML'),
  threaded: z.boolean().default(true),
  graded: z.boolean().default(false),
  points: z.number().nonnegative().default(0),
  dueAt: canvasDate.optional(),
  assignmentGroup: z.string().optional(),
  published: z.boolean().default(false),
});

export const fileItemSchema = z.object({
  type: z.literal('file'),
  title: z.string().min(1),
  path: z
    .string()
    .min(1)
    .regex(/^(?!\/)(?!.*\.\.)[^\0]+$/, 'relative path without ".." segments')
    .describe('Path inside the cartridge web_resources/ tree, e.g. "readings/week1.pdf"'),
  contentBase64: z
    .string()
    .optional()
    .describe('File bytes as base64; may instead be supplied to the builder via its files option'),
});

export const linkItemSchema = z.object({
  type: z.literal('link'),
  title: z.string().min(1),
  url: z.string().url(),
});

export const headerItemSchema = z.object({
  type: z.literal('header'),
  title: z.string().min(1).describe('Text sub-header shown inside the module'),
});

export const moduleItemSchema = z.discriminatedUnion('type', [
  pageItemSchema,
  assignmentItemSchema,
  quizItemSchema,
  discussionItemSchema,
  fileItemSchema,
  linkItemSchema,
  headerItemSchema,
]);

export type ModuleItem = z.infer<typeof moduleItemSchema>;
export type PageItem = z.infer<typeof pageItemSchema>;
export type AssignmentItem = z.infer<typeof assignmentItemSchema>;
export type QuizItem = z.infer<typeof quizItemSchema>;
export type DiscussionItem = z.infer<typeof discussionItemSchema>;
export type FileItem = z.infer<typeof fileItemSchema>;
export type LinkItem = z.infer<typeof linkItemSchema>;
export type HeaderItem = z.infer<typeof headerItemSchema>;

// ---------------------------------------------------------------------------
// Course
// ---------------------------------------------------------------------------

export const moduleSchema = z.object({
  name: z.string().min(1),
  published: z.boolean().default(false),
  requireSequentialProgress: z.boolean().default(false),
  items: z.array(moduleItemSchema).default([]),
});

export type CourseModule = z.infer<typeof moduleSchema>;

export const assignmentGroupSpecSchema = z.object({
  name: z.string().min(1),
  weight: z
    .number()
    .min(0)
    .max(100)
    .default(0)
    .describe('Percent of final grade; 0 when unweighted'),
});

export const stylingSchema = z
  .object({
    institution: z.string().optional(),
    primaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    secondaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    bannerHtml: z.string().optional().describe('HTML fragment prepended to every page body'),
  })
  .describe('Optional institutional styling applied to generated page HTML');

export const courseSpecSchema = z.object({
  course: z.object({
    title: z.string().min(1),
    code: z.string().optional(),
    syllabus: z.string().optional().describe('Syllabus body HTML'),
    defaultView: z.enum(['modules', 'wiki', 'assignments', 'syllabus', 'feed']).default('modules'),
  }),
  assignmentGroups: z
    .array(assignmentGroupSpecSchema)
    .default([{ name: 'Assignments', weight: 0 }]),
  modules: z.array(moduleSchema).min(1),
  styling: stylingSchema.optional(),
});

export type CourseSpec = z.infer<typeof courseSpecSchema>;
export type CourseSpecInput = z.input<typeof courseSpecSchema>;

/** Parse + validate an untrusted CourseSpec (e.g. JSON from an agent or API). */
export function parseCourseSpec(input: unknown): CourseSpec {
  return courseSpecSchema.parse(input);
}
