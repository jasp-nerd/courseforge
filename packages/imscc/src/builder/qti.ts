import type { IdGenerator, Question, QuizItem } from '@courseforge/shared';
import { NS } from '../constants.js';
import { el, text, type XmlElement } from '../xml.js';

/**
 * QTI 1.2 writers for Canvas Classic Quizzes. Canvas keys on the
 * `question_type` metadata field; response/scoring blocks follow the shapes
 * Canvas's own exporter (canvas-lms lib/cc/qti) and moodle2cc emit.
 */

function material(html: string): XmlElement {
  return el('material', undefined, [el('mattext', { texttype: 'text/html' }, [html])]);
}

function itemMetadata(questionType: string, points: number, extra: XmlElement[] = []): XmlElement {
  return el('itemmetadata', undefined, [
    el('qtimetadata', undefined, [
      metaField('question_type', questionType),
      metaField('points_possible', String(points)),
      ...extra,
    ]),
  ]);
}

function metaField(label: string, entry: string): XmlElement {
  return el('qtimetadatafield', undefined, [text('fieldlabel', label), text('fieldentry', entry)]);
}

function outcomes(): XmlElement {
  return el('outcomes', undefined, [
    el('decvar', { maxvalue: '100', minvalue: '0', varname: 'SCORE', vartype: 'Decimal' }),
  ]);
}

function scoreCondition(conditionVar: XmlElement): XmlElement {
  return el('respcondition', { continue: 'No' }, [
    conditionVar,
    el('setvar', { varname: 'SCORE', action: 'Set' }, ['100']),
  ]);
}

function choiceResponse(
  ids: string[],
  labels: string[],
  cardinality: 'Single' | 'Multiple',
): XmlElement {
  return el('response_lid', { ident: 'response1', rcardinality: cardinality }, [
    el(
      'render_choice',
      undefined,
      ids.map((id, i) => el('response_label', { ident: id }, [material(labels[i] ?? '')])),
    ),
  ]);
}

export function writeQuestion(question: Question, ident: string, nextId: IdGenerator): XmlElement {
  switch (question.type) {
    case 'multiple_choice':
    case 'multiple_answers': {
      const answerIds = question.answers.map(() => nextId());
      const cardinality = question.type === 'multiple_choice' ? 'Single' : 'Multiple';
      const correct = question.answers
        .map((a, i) => ({ a, id: answerIds[i] as string }))
        .filter((x) => x.a.correct);
      const conditionVar =
        question.type === 'multiple_choice'
          ? el('conditionvar', undefined, [
              el('varequal', { respident: 'response1' }, [correct[0]?.id ?? '']),
            ])
          : el('conditionvar', undefined, [
              el('and', undefined, [
                ...correct.map((x) => el('varequal', { respident: 'response1' }, [x.id])),
                ...question.answers
                  .map((a, i) => ({ a, id: answerIds[i] as string }))
                  .filter((x) => !x.a.correct)
                  .map((x) =>
                    el('not', undefined, [el('varequal', { respident: 'response1' }, [x.id])]),
                  ),
              ]),
            ]);
      return el('item', { ident, title: 'Question' }, [
        itemMetadata(`${question.type}_question`, question.points, [
          metaField('original_answer_ids', answerIds.join(',')),
        ]),
        el('presentation', undefined, [
          material(question.text),
          choiceResponse(
            answerIds,
            question.answers.map((a) => a.text),
            cardinality,
          ),
        ]),
        el('resprocessing', undefined, [outcomes(), scoreCondition(conditionVar)]),
      ]);
    }

    case 'true_false': {
      const trueId = nextId();
      const falseId = nextId();
      return el('item', { ident, title: 'Question' }, [
        itemMetadata('true_false_question', question.points, [
          metaField('original_answer_ids', `${trueId},${falseId}`),
        ]),
        el('presentation', undefined, [
          material(question.text),
          choiceResponse([trueId, falseId], ['True', 'False'], 'Single'),
        ]),
        el('resprocessing', undefined, [
          outcomes(),
          scoreCondition(
            el('conditionvar', undefined, [
              el('varequal', { respident: 'response1' }, [question.correct ? trueId : falseId]),
            ]),
          ),
        ]),
      ]);
    }

    case 'short_answer': {
      return el('item', { ident, title: 'Question' }, [
        itemMetadata('short_answer_question', question.points),
        el('presentation', undefined, [
          material(question.text),
          el('response_str', { ident: 'response1', rcardinality: 'Single' }, [
            el('render_fib', undefined, [
              el('response_label', { ident: 'answer1', rshuffle: 'No' }),
            ]),
          ]),
        ]),
        el('resprocessing', undefined, [
          outcomes(),
          scoreCondition(
            el(
              'conditionvar',
              undefined,
              question.acceptedAnswers.map((answer) =>
                el('varequal', { respident: 'response1' }, [answer]),
              ),
            ),
          ),
        ]),
      ]);
    }

    case 'essay': {
      return el('item', { ident, title: 'Question' }, [
        itemMetadata('essay_question', question.points),
        el('presentation', undefined, [
          material(question.text),
          el('response_str', { ident: 'response1', rcardinality: 'Single' }, [
            el('render_fib', undefined, [
              el('response_label', { ident: 'answer1', rshuffle: 'No' }),
            ]),
          ]),
        ]),
        el('resprocessing', undefined, [
          outcomes(),
          el('respcondition', { continue: 'No' }, [el('conditionvar', undefined, [el('other')])]),
        ]),
      ]);
    }

    case 'numerical': {
      const min = question.answer - question.tolerance;
      const max = question.answer + question.tolerance;
      return el('item', { ident, title: 'Question' }, [
        itemMetadata('numerical_question', question.points),
        el('presentation', undefined, [
          material(question.text),
          el('response_str', { ident: 'response1', rcardinality: 'Single' }, [
            el('render_fib', { fibtype: 'Decimal' }, [el('response_label', { ident: 'answer1' })]),
          ]),
        ]),
        el('resprocessing', undefined, [
          outcomes(),
          scoreCondition(
            el('conditionvar', undefined, [
              question.tolerance === 0
                ? el('or', undefined, [
                    el('varequal', { respident: 'response1' }, [String(question.answer)]),
                    el('and', undefined, [
                      el('vargte', { respident: 'response1' }, [String(min)]),
                      el('varlte', { respident: 'response1' }, [String(max)]),
                    ]),
                  ])
                : el('and', undefined, [
                    el('vargte', { respident: 'response1' }, [String(min)]),
                    el('varlte', { respident: 'response1' }, [String(max)]),
                  ]),
            ]),
          ),
        ]),
      ]);
    }

    case 'matching': {
      const rightIds = question.pairs.map(() => nextId());
      const perPairScore = 100 / question.pairs.length;
      return el('item', { ident, title: 'Question' }, [
        itemMetadata('matching_question', question.points),
        el('presentation', undefined, [
          material(question.text),
          ...question.pairs.map((pair, i) =>
            el('response_lid', { ident: `response_${i + 1}` }, [
              material(pair.left),
              el(
                'render_choice',
                undefined,
                question.pairs.map((p, j) =>
                  el('response_label', { ident: rightIds[j] as string }, [material(p.right)]),
                ),
              ),
            ]),
          ),
        ]),
        el('resprocessing', undefined, [
          outcomes(),
          ...question.pairs.map((_, i) =>
            el('respcondition', undefined, [
              el('conditionvar', undefined, [
                el('varequal', { respident: `response_${i + 1}` }, [rightIds[i] as string]),
              ]),
              el('setvar', { varname: 'SCORE', action: 'Add' }, [perPairScore.toFixed(2)]),
            ]),
          ),
        ]),
      ]);
    }

    case 'text_only': {
      return el('item', { ident, title: 'Text block' }, [
        itemMetadata('text_only_question', 0),
        el('presentation', undefined, [material(question.text)]),
      ]);
    }
  }
}

/** The CC-profile QTI assessment file (assessment_qti.xml) with full question items. */
export function writeAssessmentQti(
  quiz: QuizItem,
  quizId: string,
  nextId: IdGenerator,
): XmlElement {
  return el(
    'questestinterop',
    {
      xmlns: NS.qti,
      'xmlns:xsi': NS.xsi,
      'xsi:schemaLocation': `${NS.qti} http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_qtiasiv1p2p1_v1p0.xsd`,
    },
    [
      el('assessment', { ident: quizId, title: quiz.title }, [
        el('qtimetadata', undefined, [
          metaField('cc_profile', 'cc.exam.v0p1'),
          metaField('qmd_assessmenttype', 'Examination'),
          metaField('qmd_scoretype', 'Percentage'),
          metaField(
            'cc_maxattempts',
            quiz.allowedAttempts === -1 ? 'unlimited' : String(quiz.allowedAttempts),
          ),
        ]),
        el(
          'section',
          { ident: 'root_section' },
          quiz.questions.map((q) => writeQuestion(q, nextId(), nextId)),
        ),
      ]),
    ],
  );
}
