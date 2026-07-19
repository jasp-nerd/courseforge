import type { Canvas, CanvasId } from '@courseforge/canvas-client';
import type { CourseSpec, ModuleItem, Question } from '@courseforge/shared';

/**
 * "api" build mode: create the CourseSpec content with granular Canvas API
 * calls instead of a cartridge import. Slower (one request per item) but works
 * without file-upload rights and gives per-item feedback.
 */

interface BuildLog {
  created: string[];
  warnings: string[];
}

function questionToCanvasAnswers(question: Question): Array<Record<string, unknown>> | undefined {
  switch (question.type) {
    case 'multiple_choice':
    case 'multiple_answers':
      return question.answers.map((a) => ({
        answer_text: a.text,
        answer_weight: a.correct ? 100 : 0,
      }));
    case 'true_false':
      return [
        { answer_text: 'True', answer_weight: question.correct ? 100 : 0 },
        { answer_text: 'False', answer_weight: question.correct ? 0 : 100 },
      ];
    case 'short_answer':
      return question.acceptedAnswers.map((text) => ({ answer_text: text, answer_weight: 100 }));
    case 'numerical':
      return [
        {
          answer_weight: 100,
          numerical_answer_type: 'range_answer',
          answer_range_start: question.answer - question.tolerance,
          answer_range_end: question.answer + question.tolerance,
        },
      ];
    case 'matching':
      return question.pairs.map((p) => ({
        answer_match_left: p.left,
        answer_match_right: p.right,
      }));
    default:
      return undefined;
  }
}

function canvasQuestionType(question: Question): string {
  const map: Record<Question['type'], string> = {
    multiple_choice: 'multiple_choice_question',
    multiple_answers: 'multiple_answers_question',
    true_false: 'true_false_question',
    short_answer: 'short_answer_question',
    essay: 'essay_question',
    numerical: 'numerical_question',
    matching: 'matching_question',
    text_only: 'text_only_question',
  };
  return map[question.type];
}

export async function buildCourseViaApi(
  canvas: Canvas,
  courseId: CanvasId,
  spec: CourseSpec,
): Promise<BuildLog> {
  const log: BuildLog = { created: [], warnings: [] };

  if (spec.course.syllabus) {
    await canvas.courses.updateSyllabus(courseId, spec.course.syllabus);
    log.created.push('syllabus');
  }

  const groupIds = new Map<string, CanvasId>();
  for (const group of spec.assignmentGroups) {
    const created = await canvas.assignments.createGroup(courseId, {
      name: group.name,
      group_weight: group.weight,
    });
    groupIds.set(group.name, created.id);
    log.created.push(`assignment group "${group.name}"`);
  }
  const defaultGroupId = groupIds.values().next().value as CanvasId | undefined;

  for (const mod of spec.modules) {
    const module = await canvas.modules.create(courseId, { name: mod.name });
    log.created.push(`module "${mod.name}"`);

    for (const item of mod.items) {
      await createItem(canvas, courseId, module.id, item, groupIds, defaultGroupId, log);
    }
    if (mod.published) {
      await canvas.modules.update(courseId, module.id, { published: true });
    }
  }
  return log;
}

async function createItem(
  canvas: Canvas,
  courseId: CanvasId,
  moduleId: CanvasId,
  item: ModuleItem,
  groupIds: Map<string, CanvasId>,
  defaultGroupId: CanvasId | undefined,
  log: BuildLog,
): Promise<void> {
  const groupFor = (name?: string) => (name ? groupIds.get(name) : undefined) ?? defaultGroupId;

  switch (item.type) {
    case 'page': {
      const page = await canvas.pages.create(courseId, {
        title: item.title,
        body: item.body,
        published: item.published,
      });
      await canvas.modules.createItem(courseId, moduleId, { type: 'Page', page_url: page.url });
      log.created.push(`page "${item.title}"`);
      return;
    }
    case 'assignment': {
      const assignment = await canvas.assignments.create(courseId, {
        name: item.title,
        description: item.body,
        points_possible: item.points,
        due_at: item.dueAt,
        unlock_at: item.unlockAt,
        lock_at: item.lockAt,
        submission_types: item.submissionTypes,
        grading_type: item.gradingType,
        assignment_group_id: groupFor(item.assignmentGroup),
        published: item.published,
        peer_reviews: item.peerReviews,
      });
      await canvas.modules.createItem(courseId, moduleId, {
        type: 'Assignment',
        content_id: assignment.id,
      });
      log.created.push(`assignment "${item.title}"`);
      return;
    }
    case 'quiz': {
      const quiz = await canvas.quizzes.create(courseId, {
        title: item.title,
        description: item.description,
        quiz_type: item.quizType,
        due_at: item.dueAt,
        allowed_attempts: item.allowedAttempts,
        shuffle_answers: item.shuffleAnswers,
        one_question_at_a_time: item.oneQuestionAtATime,
        published: false,
      });
      for (const question of item.questions) {
        await canvas.quizzes.createQuestion(courseId, quiz.id, {
          question_text: question.text,
          question_type: canvasQuestionType(question),
          points_possible: 'points' in question ? question.points : 0,
          answers: questionToCanvasAnswers(question),
        });
      }
      await canvas.modules.createItem(courseId, moduleId, { type: 'Quiz', content_id: quiz.id });
      log.created.push(`quiz "${item.title}" (${item.questions.length} questions)`);
      return;
    }
    case 'discussion': {
      const discussion = await canvas.discussions.create(courseId, {
        title: item.title,
        message: item.body,
        discussion_type: item.threaded ? 'threaded' : 'side_comment',
        published: item.published,
        ...(item.graded
          ? {
              assignment: {
                points_possible: item.points,
                grading_type: 'points',
                due_at: item.dueAt,
              },
            }
          : {}),
      });
      await canvas.modules.createItem(courseId, moduleId, {
        type: 'Discussion',
        content_id: discussion.id,
      });
      log.created.push(`discussion "${item.title}"`);
      return;
    }
    case 'link': {
      await canvas.modules.createItem(courseId, moduleId, {
        type: 'ExternalUrl',
        title: item.title,
        external_url: item.url,
      });
      log.created.push(`link "${item.title}"`);
      return;
    }
    case 'header': {
      await canvas.modules.createItem(courseId, moduleId, {
        type: 'SubHeader',
        title: item.title,
      });
      log.created.push(`header "${item.title}"`);
      return;
    }
    case 'file': {
      log.warnings.push(
        `file "${item.title}" skipped in api mode — use import mode (build_course_from_spec with mode="import") for file items`,
      );
      return;
    }
  }
}
