import {
  evaluateCondition,
  hasEmergencyTrigger,
  missingRequired,
  nextQuestion,
  visibleQuestions,
} from './evaluator';
import { conditionCases } from './evaluator.fixtures';
import type { EvaluationContext } from './types';
import { questionnaireV1, rulesV1 } from './v1';
import { validateQuestionnaire } from './validate';

describe('evaluateCondition', () => {
  it.each(conditionCases)('$name', ({ condition, context, expected }) => {
    expect(evaluateCondition(condition, context)).toBe(expected);
  });
});

describe('questionnaire v1 integrity', () => {
  it('passes structural validation', () => {
    expect(validateQuestionnaire(questionnaireV1, rulesV1)).toEqual([]);
  });

  it('asks the red flags before any regional branch', () => {
    const keys = questionnaireV1.questions.map((q) => q.key);
    const lastRedFlag = Math.max(
      ...questionnaireV1.questions
        .filter((q) => q.isRedFlag)
        .map((q) => keys.indexOf(q.key)),
    );
    const firstBranch = Math.min(
      keys.indexOf('lbp_duration'),
      keys.indexOf('neck_duration'),
    );
    expect(lastRedFlag).toBeLessThan(firstBranch);
  });

  it('has every question reachable by some answer set', () => {
    // A question no context can ever reveal is dead content. Several contexts
    // are needed because some questions are mutually exclusive by design —
    // symptom_area only appears when no region was named, and is_pregnant only
    // for a woman of childbearing age.
    const contexts: EvaluationContext[] = [
      {
        age: 60,
        gender: 'male',
        chief_complaint: [
          'neck_pain',
          'low_back_pain',
          'leg_pain',
          'arm_pain',
          'walking_difficulty',
        ],
        lbp_radiate: 'below_knee',
        lbp_walk_distance: 'lt_100m',
        neck_radiate: 'below_elbow',
        neck_numbness_hand: 'yes',
        neck_grip: 'yes',
        myelo_buttons: 'yes',
        myelo_gait: 'yes',
        hip_groin: 'yes',
        tx_tried: ['physio', 'surgery'],
        img_done: ['mri'],
      },
      // Symptom named without a region.
      { age: 40, gender: 'male', chief_complaint: ['numbness'] },
      // Woman of childbearing age.
      { age: 30, gender: 'female', chief_complaint: ['low_back_pain'] },
    ];

    const reachable = new Set<string>();
    for (const context of contexts) {
      for (const question of visibleQuestions(questionnaireV1, context)) {
        reachable.add(question.key);
      }
    }

    const unreachable = questionnaireV1.questions
      .map((q) => q.key)
      .filter((key) => !reachable.has(key));

    expect(unreachable).toEqual([]);
  });
});

describe('branching', () => {
  const base: EvaluationContext = {
    name: 'Test',
    age: 43,
    gender: 'male',
    mobile: '9999999999',
    occupation: 'driver',
  };

  it('opens only the lumbar branch for a low back complaint', () => {
    const context: EvaluationContext = {
      ...base,
      chief_complaint: ['low_back_pain'],
      primary_complaint: 'low_back_pain',
    };
    const keys = visibleQuestions(questionnaireV1, context).map((q) => q.key);

    expect(keys).toContain('lbp_duration');
    expect(keys).not.toContain('neck_duration');
    expect(keys).not.toContain('myelo_buttons');
  });

  it('opens only the cervical branch for a neck complaint', () => {
    const context: EvaluationContext = {
      ...base,
      chief_complaint: ['neck_pain'],
      primary_complaint: 'neck_pain',
    };
    const keys = visibleQuestions(questionnaireV1, context).map((q) => q.key);

    expect(keys).toContain('neck_duration');
    expect(keys).toContain('myelo_buttons');
    expect(keys).not.toContain('lbp_duration');
  });

  it('asks where the problem is when only numbness is selected', () => {
    const context: EvaluationContext = {
      ...base,
      chief_complaint: ['numbness'],
      primary_complaint: 'numbness',
    };
    const keys = visibleQuestions(questionnaireV1, context).map((q) => q.key);

    // Without symptom_area this patient would answer almost nothing.
    expect(keys).toContain('symptom_area');
    expect(keys).not.toContain('lbp_duration');

    const routed = { ...context, symptom_area: 'back_leg' };
    expect(
      visibleQuestions(questionnaireV1, routed).map((q) => q.key),
    ).toContain('lbp_duration');
  });

  it('skips the whole clinical body when the patient picks none of these', () => {
    const context: EvaluationContext = {
      ...base,
      chief_complaint: ['none_of_these'],
    };
    const keys = visibleQuestions(questionnaireV1, context).map((q) => q.key);

    expect(keys).not.toContain('primary_complaint');
    expect(keys).not.toContain('func_work');
    expect(keys).not.toContain('tx_tried');
    // ...but red flags and the free-text escape hatch are still asked.
    expect(keys).toContain('rf_bladder');
    expect(keys).toContain('free_text');
  });

  it('asks about pregnancy only for women of childbearing age', () => {
    const male = { ...base, gender: 'male' };
    const youngWoman = { ...base, gender: 'female', age: 30 };
    const olderWoman = { ...base, gender: 'female', age: 68 };

    const keysFor = (ctx: EvaluationContext) =>
      visibleQuestions(questionnaireV1, ctx).map((q) => q.key);

    expect(keysFor(male)).not.toContain('is_pregnant');
    expect(keysFor(youngWoman)).toContain('is_pregnant');
    expect(keysFor(olderWoman)).not.toContain('is_pregnant');
  });

  it('hides follow-ups until their trigger is answered', () => {
    const context: EvaluationContext = {
      ...base,
      chief_complaint: ['low_back_pain'],
      primary_complaint: 'low_back_pain',
      tx_tried: ['rest'],
    };
    expect(
      visibleQuestions(questionnaireV1, context).map((q) => q.key),
    ).not.toContain('tx_physio_duration');

    const withPhysio = { ...context, tx_tried: ['physio'] };
    expect(
      visibleQuestions(questionnaireV1, withPhysio).map((q) => q.key),
    ).toContain('tx_physio_duration');
  });
});

describe('flow helpers', () => {
  it('nextQuestion walks the first unanswered visible question', () => {
    expect(nextQuestion(questionnaireV1, {})?.key).toBe('name');

    const partial: EvaluationContext = { name: 'Test' };
    expect(nextQuestion(questionnaireV1, partial)?.key).toBe('age');
  });

  it('missingRequired ignores optional questions', () => {
    const context: EvaluationContext = {
      name: 'Test',
      age: 40,
      gender: 'male',
      mobile: '9999999999',
      occupation: 'driver',
      chief_complaint: ['none_of_these'],
      rf_bladder: 'no',
      rf_bowel: 'no',
      rf_saddle: 'no',
      rf_progressive_weakness: 'no',
      rf_trauma: 'no',
      rf_fever: 'no',
      rf_cancer: 'no',
      rf_weight_loss: 'no',
      rf_night_pain: 'no',
      rf_immuno: 'no',
      comorbidities: ['none'],
    };
    // `city` and `free_text` are optional, so nothing should be outstanding.
    expect(missingRequired(questionnaireV1, context).map((q) => q.key)).toEqual(
      [],
    );
  });

  it('detects an emergency trigger, treating unsure as yes', () => {
    expect(
      hasEmergencyTrigger(questionnaireV1, { rf_saddle: 'unsure' }).map(
        (q) => q.key,
      ),
    ).toEqual(['rf_saddle']);

    expect(hasEmergencyTrigger(questionnaireV1, { rf_saddle: 'no' })).toEqual(
      [],
    );

    // Progressive weakness triggers on yes only — "not sure" is too common
    // an answer there to justify an emergency screen.
    expect(
      hasEmergencyTrigger(questionnaireV1, {
        rf_progressive_weakness: 'unsure',
      }),
    ).toEqual([]);
  });
});
