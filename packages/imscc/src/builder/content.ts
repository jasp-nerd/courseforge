import type {
  AssignmentItem,
  DiscussionItem,
  LinkItem,
  PageItem,
  QuizItem,
} from '@courseforge/shared';
import { CANVAS_SCHEMA_LOCATION, NS } from '../constants.js';
import { el, escapeXml, text, type XmlElement } from '../xml.js';

/** Slugify a title for wiki_content filenames, the way Canvas does. */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}

function htmlDocument(title: string, headExtra: string, body: string): string {
  return [
    '<html>',
    '<head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>',
    `<title>${escapeXml(title)}</title>`,
    headExtra,
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
    '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function writePageHtml(page: PageItem, identifier: string, bannerHtml?: string): string {
  const metas = [
    `<meta name="identifier" content="${escapeXml(identifier)}"/>`,
    '<meta name="editing_roles" content="teachers"/>',
    `<meta name="workflow_state" content="${page.published ? 'active' : 'unpublished'}"/>`,
  ].join('\n');
  const body = bannerHtml ? `${bannerHtml}\n${page.body}` : page.body;
  return htmlDocument(page.title, metas, body);
}

export function writeAssignmentHtml(assignment: AssignmentItem, bannerHtml?: string): string {
  const body = bannerHtml ? `${bannerHtml}\n${assignment.body}` : assignment.body;
  return htmlDocument(`Assignment: ${assignment.title}`, '', body);
}

const canvasRootAttrs = {
  xmlns: NS.canvas,
  'xmlns:xsi': NS.xsi,
  'xsi:schemaLocation': CANVAS_SCHEMA_LOCATION,
};

export function writeAssignmentSettings(
  assignment: AssignmentItem,
  identifier: string,
  groupIdentifier: string,
  position: number,
): XmlElement {
  return el('assignment', { identifier, ...canvasRootAttrs }, [
    text('title', assignment.title),
    assignment.dueAt ? text('due_at', assignment.dueAt) : el('due_at'),
    assignment.lockAt ? text('lock_at', assignment.lockAt) : el('lock_at'),
    assignment.unlockAt ? text('unlock_at', assignment.unlockAt) : el('unlock_at'),
    text('module_locked', 'false'),
    text('assignment_group_identifierref', groupIdentifier),
    text('workflow_state', assignment.published ? 'active' : 'unpublished'),
    text('points_possible', assignment.points.toFixed(1)),
    text('grading_type', assignment.gradingType),
    text('submission_types', assignment.submissionTypes.join(',')),
    text('position', position),
    text('peer_reviews', String(assignment.peerReviews)),
    text('peer_review_count', '0'),
    text('omit_from_final_grade', 'false'),
    el('post_policy', undefined, [text('post_manually', 'false')]),
  ]);
}

export function writeAssessmentMeta(
  quiz: QuizItem,
  quizIdentifier: string,
  assignmentIdentifier: string,
  groupIdentifier: string,
): XmlElement {
  const workflowState = quiz.published ? 'active' : 'unpublished';
  return el('quiz', { identifier: quizIdentifier, ...canvasRootAttrs }, [
    text('title', quiz.title),
    { name: 'description', raw: escapeXml(quiz.description) },
    text('shuffle_answers', String(quiz.shuffleAnswers)),
    text('scoring_policy', quiz.scoringPolicy),
    text('hide_results', ''),
    text('quiz_type', quiz.quizType),
    text('points_possible', quizPoints(quiz).toFixed(1)),
    quiz.dueAt ? text('due_at', quiz.dueAt) : el('due_at'),
    text('require_lockdown_browser', 'false'),
    text('require_lockdown_browser_for_results', 'false'),
    text('require_lockdown_monitor', 'false'),
    text('shuffle_questions', 'false'),
    text('allowed_attempts', quiz.allowedAttempts),
    text('one_question_at_a_time', String(quiz.oneQuestionAtATime)),
    text('show_correct_answers', 'true'),
    text('anonymous_submissions', 'false'),
    text('could_be_locked', 'false'),
    text('available', String(quiz.published)),
    el('assignment', { identifier: assignmentIdentifier }, [
      text('title', quiz.title),
      quiz.dueAt ? text('due_at', quiz.dueAt) : el('due_at'),
      text('module_locked', 'false'),
      text('workflow_state', workflowState),
      text('assignment_overrides', ''),
      text('quiz_identifierref', quizIdentifier),
      text('allowed_extensions', ''),
      text('has_group_category', 'false'),
      text('points_possible', quizPoints(quiz).toFixed(1)),
      text('grading_type', 'points'),
      text('all_day', 'false'),
      text('submission_types', 'online_quiz'),
      text('position', '1'),
      text('turnitin_enabled', 'false'),
      text('vericite_enabled', 'false'),
      text('peer_review_count', '0'),
      text('peer_reviews', 'false'),
      text('automatic_peer_reviews', 'false'),
      text('anonymous_peer_reviews', 'false'),
      text('grade_group_students_individually', 'false'),
      text('freeze_on_copy', 'false'),
      text('omit_from_final_grade', 'false'),
      text('intra_group_peer_reviews', 'false'),
      text('only_visible_to_overrides', 'false'),
      text('post_to_sis', 'false'),
      text('moderated_grading', 'false'),
      text('grader_count', '0'),
      text('grader_comments_visible_to_graders', 'true'),
      text('anonymous_grading', 'false'),
      text('graders_anonymous_to_graders', 'false'),
      text('grader_names_visible_to_final_grader', 'true'),
      text('anonymous_instructor_annotations', 'false'),
      text('assignment_group_identifierref', groupIdentifier),
      el('post_policy', undefined, [text('post_manually', 'false')]),
    ]),
    text('assignment_group_identifierref', groupIdentifier),
    text('assignment_overrides', ''),
  ]);
}

export function quizPoints(quiz: QuizItem): number {
  return quiz.questions.reduce((sum, q) => sum + ('points' in q ? q.points : 0), 0);
}

/** The portable CC discussion topic file (imsdt). Body is entity-escaped HTML. */
export function writeDiscussionTopic(discussion: DiscussionItem): XmlElement {
  return el(
    'topic',
    {
      xmlns: NS.imsdt,
      'xmlns:xsi': NS.xsi,
      'xsi:schemaLocation': `${NS.imsdt} http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imsdt_v1p1.xsd`,
    },
    [
      text('title', discussion.title),
      { name: 'text', attrs: { texttype: 'text/html' }, raw: escapeXml(discussion.body) },
    ],
  );
}

/** The Canvas topicMeta LOR that carries discussion settings + optional graded assignment. */
export function writeTopicMeta(
  discussion: DiscussionItem,
  metaIdentifier: string,
  topicIdentifier: string,
  assignmentIdentifier: string | undefined,
  groupIdentifier: string,
): XmlElement {
  return el('topicMeta', { identifier: metaIdentifier, ...canvasRootAttrs }, [
    text('topic_id', topicIdentifier),
    text('title', discussion.title),
    text('type', 'topic'),
    text('discussion_type', discussion.threaded ? 'threaded' : 'side_comment'),
    text('pinned', 'false'),
    text('position', ''),
    text('workflow_state', discussion.published ? 'active' : 'unpublished'),
    text('module_locked', 'false'),
    text('allow_rating', 'false'),
    text('only_graders_can_rate', 'false'),
    text('sort_by_rating', 'false'),
    text('todo_date', ''),
    discussion.graded && assignmentIdentifier
      ? el('assignment', { identifier: assignmentIdentifier }, [
          text('title', discussion.title),
          discussion.dueAt ? text('due_at', discussion.dueAt) : el('due_at'),
          text('workflow_state', discussion.published ? 'active' : 'unpublished'),
          text('points_possible', discussion.points.toFixed(1)),
          text('grading_type', 'points'),
          text('submission_types', 'discussion_topic'),
          text('assignment_group_identifierref', groupIdentifier),
        ])
      : undefined,
  ]);
}

export function writeWebLink(link: LinkItem): XmlElement {
  return el(
    'webLink',
    {
      xmlns: NS.imswl,
      'xmlns:xsi': NS.xsi,
      'xsi:schemaLocation': `${NS.imswl} http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imswl_v1p1.xsd`,
    },
    [text('title', link.title), el('url', { href: link.url, target: '_iframe' })],
  );
}
