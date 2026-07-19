import { describe, expect, it } from 'vitest';
import { parseCourseSpec } from './course-spec.js';
import { localDateTimeToUtc, normalizeSpecDate, toCartridgeDate } from './dates.js';
import { isValidCartridgeId, randomId, sequentialIdGenerator } from './ids.js';

const minimalSpec = {
  course: { title: 'Intro to Chemistry' },
  modules: [
    {
      name: 'Week 1',
      items: [
        { type: 'page', title: 'Welcome', body: '<p>Hi</p>' },
        {
          type: 'assignment',
          title: 'Lab report',
          points: 10,
          dueAt: '2026-09-01T23:59:00',
        },
        {
          type: 'quiz',
          title: 'Checkpoint',
          questions: [
            {
              type: 'multiple_choice',
              text: 'What is 2+2?',
              answers: [{ text: '4', correct: true }, { text: '5' }],
            },
          ],
        },
      ],
    },
  ],
};

describe('courseSpecSchema', () => {
  it('parses a minimal spec and applies defaults', () => {
    const spec = parseCourseSpec(minimalSpec);
    expect(spec.course.defaultView).toBe('modules');
    expect(spec.assignmentGroups).toEqual([{ name: 'Assignments', weight: 0 }]);
    expect(spec.modules[0]?.published).toBe(false);
    const assignment = spec.modules[0]?.items[1];
    if (assignment?.type !== 'assignment') throw new Error('expected assignment');
    expect(assignment.submissionTypes).toEqual(['online_text_entry']);
    expect(assignment.published).toBe(false);
    const quiz = spec.modules[0]?.items[2];
    if (quiz?.type !== 'quiz') throw new Error('expected quiz');
    expect(quiz.quizType).toBe('assignment');
    expect(quiz.questions[0]?.type).toBe('multiple_choice');
  });

  it('rejects a multiple choice question without exactly one correct answer', () => {
    const bad = JSON.parse(JSON.stringify(minimalSpec)) as Record<string, unknown>;
    // biome-ignore lint/suspicious/noExplicitAny: test fixture surgery
    (bad as any).modules[0].items[2].questions[0].answers[1].correct = true;
    expect(() => parseCourseSpec(bad)).toThrow(/exactly one correct/);
  });

  it('rejects bad dates, colors, and file paths', () => {
    expect(() =>
      parseCourseSpec({
        ...minimalSpec,
        modules: [{ name: 'M', items: [{ type: 'assignment', title: 'A', dueAt: 'tomorrow' }] }],
      }),
    ).toThrow(/ISO datetime/);

    expect(() => parseCourseSpec({ ...minimalSpec, styling: { primaryColor: 'blue' } })).toThrow();

    expect(() =>
      parseCourseSpec({
        ...minimalSpec,
        modules: [{ name: 'M', items: [{ type: 'file', title: 'F', path: '../evil.sh' }] }],
      }),
    ).toThrow();
  });

  it('rejects an empty course', () => {
    expect(() => parseCourseSpec({ course: { title: 'X' }, modules: [] })).toThrow();
  });
});

describe('ids', () => {
  it('randomId produces g + 32 hex and validates', () => {
    const id = randomId();
    expect(id).toMatch(/^g[0-9a-f]{32}$/);
    expect(isValidCartridgeId(id)).toBe(true);
  });

  it('sequential generator is deterministic and shape-compatible', () => {
    const gen = sequentialIdGenerator();
    const a = gen();
    expect(a).toBe('gaaaaaaaaaaaaaaaaaaaaaaaa00000001');
    expect(a).toHaveLength(33);
    expect(gen()).toBe('gaaaaaaaaaaaaaaaaaaaaaaaa00000002');
    expect(isValidCartridgeId(a)).toBe(true);
  });

  it('rejects ids starting with a digit', () => {
    expect(isValidCartridgeId('1abc')).toBe(false);
  });
});

describe('dates', () => {
  it('formats cartridge dates without ms or zone', () => {
    expect(toCartridgeDate(new Date(Date.UTC(2026, 8, 1, 23, 59, 30)))).toBe('2026-09-01T23:59:30');
  });

  it('converts course-local wall clock to UTC across DST', () => {
    // Amsterdam is UTC+2 in September (CEST) and UTC+1 in January (CET).
    expect(localDateTimeToUtc('2026-09-11T23:59:00', 'Europe/Amsterdam')).toBe(
      '2026-09-11T21:59:00',
    );
    expect(localDateTimeToUtc('2026-01-15T23:59', 'Europe/Amsterdam')).toBe('2026-01-15T22:59:00');
    expect(localDateTimeToUtc('2026-06-01T08:00:00', 'America/New_York')).toBe(
      '2026-06-01T12:00:00',
    );
    expect(localDateTimeToUtc('2026-06-01T12:00:00', 'UTC')).toBe('2026-06-01T12:00:00');
  });

  it('rejects malformed local datetimes', () => {
    expect(() => localDateTimeToUtc('tomorrow', 'Europe/Amsterdam')).toThrow(/invalid datetime/);
  });

  it('normalizes minute-precision spec dates', () => {
    expect(normalizeSpecDate('2026-09-01T23:59')).toBe('2026-09-01T23:59:00');
    expect(normalizeSpecDate('2026-09-01T23:59:12')).toBe('2026-09-01T23:59:12');
  });

  it('throws on invalid input', () => {
    expect(() => toCartridgeDate('nonsense')).toThrow(/invalid date/);
  });
});
