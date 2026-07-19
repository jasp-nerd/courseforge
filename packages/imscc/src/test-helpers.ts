import type { CourseSpecInput } from '@courseforge/shared';

/** A spec exercising every item type — used by builder, round-trip, and golden tests. */
export const demoSpec: CourseSpecInput = {
  course: {
    title: 'Introduction to Chemistry',
    code: 'CHEM-101',
    syllabus: '<p>Welcome to CHEM-101. We meet twice a week.</p>',
    defaultView: 'modules',
  },
  assignmentGroups: [
    { name: 'Assignments', weight: 60 },
    { name: 'Participation', weight: 40 },
  ],
  modules: [
    {
      name: 'Week 1 — Matter',
      published: true,
      items: [
        { type: 'header', title: 'Get started' },
        {
          type: 'page',
          title: 'Welcome & Overview',
          body: '<h2>Welcome!</h2><p>Read this first.</p>',
        },
        {
          type: 'link',
          title: 'LibreTexts: Scope of Chemistry',
          url: 'https://chem.libretexts.org/intro',
        },
        {
          type: 'assignment',
          title: 'Lab Safety Contract',
          body: '<p>Upload your signed safety contract.</p>',
          points: 10,
          submissionTypes: ['online_upload'],
          dueAt: '2026-09-07T23:59:00',
          assignmentGroup: 'Assignments',
        },
        {
          type: 'discussion',
          title: 'Introduce yourself',
          body: '<p>Say hi & share why you chose chemistry.</p>',
          graded: true,
          points: 5,
          assignmentGroup: 'Participation',
        },
      ],
    },
    {
      name: 'Week 2 — Atoms',
      items: [
        {
          type: 'quiz',
          title: 'Atoms checkpoint',
          description: '<p>Quick check on atomic structure.</p>',
          questions: [
            {
              type: 'multiple_choice',
              text: '<p>What is the charge of a proton?</p>',
              points: 2,
              answers: [
                { text: 'Positive', correct: true },
                { text: 'Negative' },
                { text: 'Neutral' },
              ],
            },
            {
              type: 'true_false',
              text: '<p>Electrons orbit the nucleus.</p>',
              points: 1,
              correct: true,
            },
            {
              type: 'short_answer',
              text: '<p>Chemical symbol for gold?</p>',
              points: 1,
              acceptedAnswers: ['Au', 'au'],
            },
            { type: 'essay', text: '<p>Explain isotopes in your own words.</p>', points: 5 },
            {
              type: 'numerical',
              text: '<p>Atomic number of carbon?</p>',
              points: 1,
              answer: 6,
              tolerance: 0,
            },
            {
              type: 'matching',
              text: '<p>Match particle to charge.</p>',
              points: 3,
              pairs: [
                { left: 'Proton', right: '+1' },
                { left: 'Electron', right: '-1' },
                { left: 'Neutron', right: '0' },
              ],
            },
            { type: 'text_only', text: '<p>The following questions cover the periodic table.</p>' },
          ],
        },
        {
          type: 'file',
          title: 'Periodic table handout',
          path: 'handouts/periodic-table.txt',
          contentBase64: Buffer.from('H He Li Be B C N O F Ne').toString('base64'),
        },
      ],
    },
  ],
  styling: {
    institution: 'Vrije Universiteit Amsterdam',
    primaryColor: '#0077b3',
    bannerHtml: '<div class="cf-banner">CHEM-101</div>',
  },
};
