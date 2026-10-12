import {
  evaluateCondition,
  hasEmergencyTrigger,
  missingRequired,
  nextQuestion,
  visibleQuestions,
} from './evaluator';
import { conditionCases } from './evaluator.fixtures';
import type { EvaluationContext } from './types';
import { questionnaireV2, rulesV2 } from './v2';
import { validateQuestionnaire } from './validate';

describe('evaluateCondition', () => {
  it.each(conditionCases)('$name', ({ condition, context, expected }) => {
    expect(evaluateCondition(condition, context)).toBe(expected);
  });
});

describe('questionnaire v2 integrity', () => {
  it('passes structural validation', () => {
    expect(validateQuestionnaire(questionnaireV2, rulesV2)).toEqual([]);
  });

  it("asks the doctor's ten questions in his order", () => {
    const keys = questionnaireV2.questions.map((q) => q.key);
    const doctorOrder = [
      'main_problem', // 1
      'weakness', // 2
      'walking_balance', // 3
      'duration', // 4
      'treatment', // 5
      'treatment_response', // 6
      'has_imaging', // 7
      'diagnosis', // 8
      'surgery_advised', // 9
      'consult_reason', // 10
    ];
    const positions = doctorOrder.map((k) => keys.indexOf(k));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('asks nothing the doctor did not ask', () => {
    // Section A (plus gender, which the WhatsApp summary's Mr./Mrs. needs),
    // his ten questions, and the "if yes / other" follow-ups.
    expect(questionnaireV2.questions.map((q) => q.key)).toEqual([
      'name',
      'age',
      'gender',
      'mobile',
      'city',
      'previous_patient',
      'main_problem',
      'main_problem_other',
      'weakness',
      'walking_balance',
      'duration',
      'treatment',
      'treatment_response',
      'has_imaging',
      'diagnosis',
      'diagnosis_other',
      'surgery_advised',
      'surgery_advised_detail',
      'consult_reason',
    ]);
  });

  it("groups the questions into the form's sections A–E", () => {
    expect(questionnaireV2.sections.map((s) => s.key)).toEqual([
      'details',
      'problem',
      'treatment',
      'imaging',
      'reason',
    ]);
  });

  it('has every question reachable by some answer set', () => {
    // Two contexts because the follow-ups need their trigger answered.
    const contexts: EvaluationContext[] = [
      {
        main_problem: ['back_pain', 'other'],
        treatment: ['physio'],
        diagnosis: ['other'],
        surgery_advised: 'yes',
      },
      {
        main_problem: ['neck_pain'],
        treatment: ['none'],
        diagnosis: ['dont_know'],
        surgery_advised: 'no',
      },
    ];
    const reachable = new Set<string>();
    for (const ctx of contexts) {
      for (const q of visibleQuestions(questionnaireV2, ctx))
        reachable.add(q.key);
    }
    const unreachable = questionnaireV2.questions
      .map((q) => q.key)
      .filter((k) => !reachable.has(k));
    expect(unreachable).toEqual([]);
  });
});

describe('branching', () => {
  const base: EvaluationContext = {
    name: 'Test',
    age: 43,
    gender: 'male',
    mobile: '9999999999',
  };

  const keysFor = (ctx: EvaluationContext) =>
    visibleQuestions(questionnaireV2, ctx).map((q) => q.key);

  it('asks for a description only when "other" is a main problem', () => {
    expect(keysFor({ ...base, main_problem: ['back_pain'] })).not.toContain(
      'main_problem_other',
    );
    expect(
      keysFor({ ...base, main_problem: ['back_pain', 'other'] }),
    ).toContain('main_problem_other');
  });

  it('asks what the doctor said only when the diagnosis is "other"', () => {
    expect(keysFor({ ...base, diagnosis: ['disc_prolapse'] })).not.toContain(
      'diagnosis_other',
    );
    expect(keysFor({ ...base, diagnosis: ['other'] })).toContain(
      'diagnosis_other',
    );
  });

  it('skips "did treatment help" when no treatment was tried', () => {
    expect(keysFor({ ...base, treatment: ['none'] })).not.toContain(
      'treatment_response',
    );
    expect(keysFor({ ...base, treatment: ['medicines'] })).toContain(
      'treatment_response',
    );
    // Unanswered is not "no treatment" — the follow-up stays hidden until
    // the patient has answered Q6 at all.
    expect(keysFor(base)).not.toContain('treatment_response');
  });

  it('asks which surgery was advised only on yes', () => {
    expect(keysFor({ ...base, surgery_advised: 'no' })).not.toContain(
      'surgery_advised_detail',
    );
    expect(keysFor({ ...base, surgery_advised: 'yes' })).toContain(
      'surgery_advised_detail',
    );
  });
});

describe('flow helpers', () => {
  it('nextQuestion walks the first unanswered visible question', () => {
    expect(nextQuestion(questionnaireV2, {})?.key).toBe('name');

    const partial: EvaluationContext = { name: 'Test' };
    expect(nextQuestion(questionnaireV2, partial)?.key).toBe('age');
  });

  it('missingRequired ignores optional questions', () => {
    const context: EvaluationContext = {
      name: 'Test',
      age: 40,
      gender: 'male',
      mobile: '9999999999',
      city: 'Delhi',
      previous_patient: 'no',
      main_problem: ['back_pain'],
      weakness: 'no',
      walking_balance: 'no',
      duration: 'lt_6w',
      treatment: ['none'],
      has_imaging: 'no',
      diagnosis: ['other'],
      surgery_advised: 'yes',
      consult_reason: 'routine_advice',
    };
    // `diagnosis_other` and `surgery_advised_detail` are optional, so nothing
    // should be outstanding.
    expect(missingRequired(questionnaireV2, context).map((q) => q.key)).toEqual(
      [],
    );
  });

  it('has no emergency trigger — the form never interrupts', () => {
    // None of the doctor's ten questions is a cauda-equina screen, so
    // nothing can halt the questionnaire early. Every patient reaches submit.
    expect(questionnaireV2.questions.some((q) => q.isEmergencyTrigger)).toBe(
      false,
    );
    expect(
      hasEmergencyTrigger(questionnaireV2, {
        weakness: 'progressive',
        walking_balance: 'progressive',
      }),
    ).toEqual([]);
  });
});
