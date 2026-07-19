import { z } from 'zod';
import { READ, type ToolContext, type ToolDefinition } from './types.js';

/** Course readiness linter, inspired by the checks experienced Canvas designers run before term start. */
export function qcTools({ canvas }: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'check_course_setup',
      description:
        'Run a readiness check on a Canvas course before publishing: assignments without due dates or points, unpublished modules/items, assignment-group weights that do not sum to 100, empty modules, quizzes without questions. Returns a structured report with per-check findings.',
      inputSchema: { course_id: z.string() },
      annotations: READ,
      audience: 'educator',
      handler: async ({ course_id }: { course_id: string }) => {
        const [assignments, modules, quizzes, groups] = await Promise.all([
          canvas.assignments.list(course_id),
          canvas.modules.list(course_id),
          canvas.quizzes.list(course_id),
          canvas.assignments.listGroups(course_id),
        ]);

        const findings: Array<{ check: string; status: 'pass' | 'warn'; details: string[] }> = [];
        const add = (check: string, problems: string[]) =>
          findings.push({
            check,
            status: problems.length === 0 ? 'pass' : 'warn',
            details: problems,
          });

        add(
          'assignments_have_due_dates',
          assignments.filter((a) => !a.due_at).map((a) => `"${a.name}" has no due date`),
        );
        add(
          'graded_assignments_have_points',
          assignments
            .filter((a) => a.grading_type !== 'not_graded' && (a.points_possible ?? 0) === 0)
            .map((a) => `"${a.name}" is graded but worth 0 points`),
        );
        add(
          'modules_published',
          modules
            .filter((m) => m.published === false)
            .map((m) => `module "${m.name}" is unpublished`),
        );
        add(
          'modules_not_empty',
          modules
            .filter((m) => (m.items_count ?? 0) === 0)
            .map((m) => `module "${m.name}" has no items`),
        );
        add(
          'quizzes_have_questions',
          quizzes
            .filter((q) => (q.question_count ?? 0) === 0)
            .map((q) => `quiz "${q.title}" has no questions`),
        );

        const totalWeight = groups.reduce((sum, g) => sum + (g.group_weight ?? 0), 0);
        add(
          'group_weights_sum_to_100',
          totalWeight > 0 && Math.round(totalWeight) !== 100
            ? [`assignment group weights sum to ${totalWeight}, expected 100`]
            : [],
        );

        return {
          course_id,
          ready: findings.every((f) => f.status === 'pass'),
          findings,
        };
      },
    },
  ];
}
