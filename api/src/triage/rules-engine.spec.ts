import { evaluateRules, redFlagsFromSchema } from './rules-engine';
import type { EvaluationContext, TriageCategory } from '../questionnaire/types';
import { questionnaireV2, rulesV2 } from '../questionnaire/v2';

/**
 * Fixture-driven tests for Dr. Acharya's screening SOP (SCREENING §2–§3).
 *
 * The rules ARE the product, so each scoring row and each category rule gets
 * a named patient whose answers should fire it, and we assert the resulting
 * score and category. Plus: the two worked examples from the SOP's WhatsApp
 * summaries, precedence (RED > A > D > B > C), the second-opinion carve-out,
 * advisory notes, and red-flag reporting.
 *
 * evaluateRules reads raw answer keys directly (branching visibility does not
 * apply here), so each fixture sets only the keys it needs on top of `clean`.
 */

const base: EvaluationContext = {
  name: 'Test Patient',
  age: 45,
  gender: 'male',
  mobile: '9999999999',
  city: 'Delhi',
  previous_patient: 'no',
};

/** A clean form: back pain only, nothing neurological, nothing surgical. */
const clean: EvaluationContext = {
  main_problem: ['back_pain'],
  weakness: 'no',
  walking_balance: 'no',
  duration: 'lt_6w',
  treatment: ['medicines'],
  treatment_response: 'partial',
  has_imaging: 'no',
  diagnosis: ['dont_know'],
  surgery_advised: 'no',
  consult_reason: 'routine_advice',
};

function run(overrides: EvaluationContext) {
  return evaluateRules(rulesV2, { ...base, ...clean, ...overrides });
}

const codes = (r: ReturnType<typeof run>) => r.matchedRules.map((m) => m.code);

describe('scoring table — one patient per row', () => {
  const rows: {
    name: string;
    answers: EvaluationContext;
    rule: string;
    points: number;
  }[] = [
    {
      name: 'Progressive weakness',
      answers: { weakness: 'progressive' },
      rule: 'SCORE_PROGRESSIVE_WEAKNESS',
      points: 4,
    },
    {
      name: 'Walking/balance deterioration',
      answers: { walking_balance: 'yes' },
      rule: 'SCORE_WALKING_DETERIORATION',
      points: 3,
    },
    {
      name: 'Significant radiating leg pain',
      answers: { main_problem: ['back_pain', 'leg_pain'] },
      rule: 'SCORE_RADIATING_PAIN',
      points: 2,
    },
    {
      name: 'Numbness/tingling',
      answers: { main_problem: ['back_pain', 'numbness_tingling'] },
      rule: 'SCORE_NUMBNESS',
      points: 1,
    },
    {
      name: 'Symptoms > 3 months',
      answers: { duration: '3_6m' },
      rule: 'SCORE_DURATION_3M',
      points: 1,
    },
    {
      name: 'Failed physiotherapy',
      answers: { treatment: ['physio'], treatment_response: 'no_improvement' },
      rule: 'SCORE_FAILED_CONSERVATIVE',
      points: 2,
    },
    {
      name: 'Symptoms worsening',
      answers: { treatment_response: 'worse' },
      rule: 'SCORE_WORSENING',
      points: 2,
    },
    {
      name: 'MRI available',
      answers: { has_imaging: 'yes' },
      rule: 'SCORE_IMAGING',
      points: 1,
    },
    {
      name: 'Structural diagnosis mentioned',
      answers: { diagnosis: ['disc_prolapse'] },
      rule: 'SCORE_STRUCTURAL_DIAGNOSIS',
      points: 2,
    },
    {
      name: 'Surgery already advised',
      answers: { surgery_advised: 'yes' },
      rule: 'SCORE_SURGERY_ADVISED',
      points: 3,
    },
    {
      name: 'Previous spine surgery',
      answers: {
        treatment: ['previous_surgery'],
        treatment_response: 'partial',
      },
      rule: 'SCORE_PREVIOUS_SURGERY',
      points: 2,
    },
    {
      name: 'Routine pain only',
      answers: {},
      rule: 'SCORE_ROUTINE_ONLY',
      points: -2,
    },
    {
      name: 'No treatment tried',
      answers: { treatment: ['none'], treatment_response: null },
      rule: 'SCORE_NO_TREATMENT',
      points: -1,
    },
    {
      name: 'Only report review requested',
      answers: { consult_reason: 'report_review' },
      rule: 'SCORE_REPORT_ONLY',
      points: -2,
    },
  ];

  it.each(rows)('$name -> $rule ($points)', ({ answers, rule, points }) => {
    const result = run(answers);
    const match = result.matchedRules.find((m) => m.code === rule);
    expect(match).toBeDefined();
    expect(match?.points).toBe(points);
  });

  it('covers every scoring rule', () => {
    const covered = new Set(rows.map((r) => r.rule));
    const uncovered = rulesV2
      .filter((r) => r.kind === 'score')
      .map((r) => r.code)
      .filter((code) => !covered.has(code));
    expect(uncovered).toEqual([]);
  });

  it('sums the matched rows', () => {
    // leg pain +2, numbness +1, >3m +1, physio failed +2, worse +2, MRI +1,
    // disc +2, surgery advised +3 = 14; "routine only" does not fire.
    const result = run({
      main_problem: ['back_pain', 'leg_pain', 'numbness_tingling'],
      duration: 'gt_6m',
      treatment: ['medicines', 'physio'],
      treatment_response: 'worse',
      has_imaging: 'yes',
      diagnosis: ['disc_prolapse'],
      surgery_advised: 'yes',
      consult_reason: 'surgery_advised',
    });
    expect(result.score).toBe(14);
    expect(codes(result)).not.toContain('SCORE_ROUTINE_ONLY');
  });

  it('routine-only deduction needs no neuro answer anywhere on Q1–Q3', () => {
    expect(codes(run({ weakness: 'stable' }))).not.toContain(
      'SCORE_ROUTINE_ONLY',
    );
    expect(
      codes(run({ main_problem: ['back_pain', 'deformity'] })),
    ).not.toContain('SCORE_ROUTINE_ONLY');
    expect(codes(run({ main_problem: ['neck_pain', 'back_pain'] }))).toContain(
      'SCORE_ROUTINE_ONLY',
    );
  });
});

describe("the SOP's worked examples", () => {
  it('Mr. ABC, 54 — 🟢 A, score 11', () => {
    // Back + bilateral leg pain, progressive leg weakness, walking difficulty,
    // symptoms >6 months, physio/medicines failed, MRI available, surgery
    // advised: TLIF. His summary says 11; the table gives
    // 4 + 3 + 2 + 1 + 2 + 1 + 3 = 16 without the worsening row, so his 11
    // is not a strict sum — the category is what matters and it is A.
    const result = run({
      age: 54,
      main_problem: ['back_pain', 'leg_pain'],
      weakness: 'progressive',
      walking_balance: 'yes',
      duration: 'gt_6m',
      treatment: ['medicines', 'physio'],
      treatment_response: 'no_improvement',
      has_imaging: 'yes',
      diagnosis: ['dont_know'],
      surgery_advised: 'yes',
      surgery_advised_detail: 'TLIF',
      consult_reason: 'surgery_advised',
    });
    expect(result.category).toBe('SURGICAL');
    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(codes(result)).toContain('A_PROGRESSIVE_WEAKNESS');
    expect(codes(result)).toContain('A_SURGERY_ADVISED');
    expect(codes(result)).toContain('A_RADICULOPATHY_DEFICIT');
  });

  it('Mrs. ABC, 38 — ⚪ C, score 1 → here -3', () => {
    // Back pain only, no leg pain, no weakness, no walking difficulty,
    // 3 weeks, no treatment yet. The table gives -2 (routine only) and -1
    // (no treatment); the SOP's "1" is not a literal sum either. What
    // matters: C, and nothing surgical fired.
    const result = run({
      gender: 'female',
      age: 38,
      treatment: ['none'],
      treatment_response: null,
    });
    expect(result.category).toBe('ROUTINE');
    expect(result.score).toBe(-3);
    expect(codes(result)).toEqual([
      'C_SCORE',
      'SCORE_ROUTINE_ONLY',
      'SCORE_NO_TREATMENT',
    ]);
  });
});

describe('category rules — one patient each', () => {
  const scenarios: {
    name: string;
    answers: EvaluationContext;
    category: TriageCategory;
    rule: string;
  }[] = [
    /* 🔴 RED */
    {
      name: 'Spine injury with numbness',
      answers: { main_problem: ['back_pain', 'injury', 'numbness_tingling'] },
      category: 'URGENT',
      rule: 'RED_TRAUMA_NEURO',
    },
    {
      name: 'Weakness and walking both progressively worse',
      answers: { weakness: 'progressive', walking_balance: 'progressive' },
      category: 'URGENT',
      rule: 'RED_RAPID_NEURO_DECLINE',
    },
    /* 🟢 A — features */
    {
      name: 'Progressive weakness, nothing else',
      answers: { weakness: 'progressive' },
      category: 'SURGICAL',
      rule: 'A_PROGRESSIVE_WEAKNESS',
    },
    {
      name: 'Walking getting progressively worse',
      answers: { walking_balance: 'progressive' },
      category: 'SURGICAL',
      rule: 'A_WALKING_DETERIORATION',
    },
    {
      name: 'Surgery already advised, wants second opinion',
      answers: {
        surgery_advised: 'yes',
        surgery_advised_detail: 'L4-L5 discectomy',
        consult_reason: 'second_opinion',
      },
      category: 'SURGICAL',
      rule: 'A_SURGERY_ADVISED',
    },
    {
      name: 'Sciatica with stable leg weakness',
      answers: { main_problem: ['back_pain', 'leg_pain'], weakness: 'stable' },
      category: 'SURGICAL',
      rule: 'A_RADICULOPATHY_DEFICIT',
    },
    {
      name: 'Known canal stenosis, leg pain not improving',
      answers: {
        main_problem: ['back_pain', 'leg_pain'],
        diagnosis: ['canal_stenosis'],
        treatment: ['medicines'],
        treatment_response: 'no_improvement',
      },
      category: 'SURGICAL',
      rule: 'A_STRUCTURAL_SIGNIFICANT',
    },
    /* Score bands */
    {
      name: 'Score 8+ from soft findings alone',
      answers: {
        // leg pain +2, >3m +1, physio failed +2, MRI +1, disc +2 = 8
        main_problem: ['back_pain', 'leg_pain'],
        duration: '3_6m',
        treatment: ['physio'],
        treatment_response: 'no_improvement',
        has_imaging: 'yes',
        diagnosis: ['disc_prolapse'],
        consult_reason: 'evaluate_surgery',
      },
      category: 'SURGICAL',
      rule: 'A_SCORE',
    },
    {
      name: 'Persistent radicular pain with MRI — score 4',
      answers: {
        // leg pain +2, >3m +1, MRI +1 = 4
        main_problem: ['back_pain', 'leg_pain'],
        duration: 'gt_6m',
        has_imaging: 'yes',
        consult_reason: 'evaluate_surgery',
      },
      category: 'REVIEW',
      rule: 'B_SCORE',
    },
    {
      name: 'Simple back pain, short duration',
      answers: {},
      category: 'ROUTINE',
      rule: 'C_SCORE',
    },
    /* ⚫ D */
    {
      name: 'Only wants MRI looked at',
      answers: { has_imaging: 'yes', consult_reason: 'report_review' },
      category: 'REPORT_ONLY',
      rule: 'D_REPORT_ONLY',
    },
    {
      name: 'Second opinion, but no one has advised surgery',
      answers: { consult_reason: 'second_opinion' },
      category: 'REPORT_ONLY',
      rule: 'D_SECOND_OPINION_NO_ADVICE',
    },
  ];

  it.each(scenarios)(
    '$name -> $category ($rule)',
    ({ answers, category, rule }) => {
      const result = run(answers);
      expect(codes(result)).toContain(rule);
      expect(result.category).toBe(category);
    },
  );

  it('covers every category rule', () => {
    const covered = new Set(scenarios.map((s) => s.rule));
    const uncovered = rulesV2
      .filter((r) => r.kind === 'category')
      .map((r) => r.code)
      .filter((code) => !covered.has(code));
    expect(uncovered).toEqual([]);
  });

  it('keeps severity bands disjoint so precedence is RED > A > D > B > C', () => {
    const band: Record<TriageCategory, [number, number]> = {
      URGENT: [90, 100],
      SURGICAL: [60, 79],
      REPORT_ONLY: [40, 49],
      REVIEW: [30, 39],
      ROUTINE: [10, 29],
    };
    for (const rule of rulesV2) {
      if (rule.kind !== 'category') continue;
      const [lo, hi] = band[rule.category];
      expect(rule.severity).toBeGreaterThanOrEqual(lo);
      expect(rule.severity).toBeLessThanOrEqual(hi);
    }
  });

  it('the score bands cover every integer, so every form gets a category', () => {
    for (let score = -6; score <= 30; score += 1) {
      const result = evaluateRules(rulesV2, { ...base, score });
      expect(result.unmatched).toBe(false);
    }
  });
});

describe('precedence', () => {
  it('RED beats A (trauma + surgery advised)', () => {
    const result = run({
      main_problem: ['back_pain', 'injury'],
      weakness: 'stable',
      surgery_advised: 'yes',
    });
    expect(codes(result)).toContain('RED_TRAUMA_NEURO');
    expect(codes(result)).toContain('A_SURGERY_ADVISED');
    expect(result.category).toBe('URGENT');
    expect(result.urgency).toBe('urgent');
  });

  it('A beats D (surgery advised + only wants report reviewed)', () => {
    const result = run({
      has_imaging: 'yes',
      surgery_advised: 'yes',
      consult_reason: 'report_review',
    });
    expect(codes(result)).toContain('A_SURGERY_ADVISED');
    expect(codes(result)).toContain('D_REPORT_ONLY');
    expect(result.category).toBe('SURGICAL');
    expect(result.urgency).toBe('priority');
  });

  it('D beats B and C (score 4 but only wants the report looked at)', () => {
    const result = run({
      // leg pain +2, >3m +1, MRI +1, disc +2, report only -2 = 4
      main_problem: ['back_pain', 'leg_pain'],
      duration: 'gt_6m',
      has_imaging: 'yes',
      diagnosis: ['disc_prolapse'],
      consult_reason: 'report_review',
    });
    expect(result.score).toBe(4);
    expect(codes(result)).toContain('B_SCORE');
    expect(result.category).toBe('REPORT_ONLY');
  });

  it('a feature-based A wins even when the score only says B', () => {
    // Progressive weakness alone scores 4 (B by score) — "significant
    // surgical features even if score is lower" makes it A.
    const result = run({ weakness: 'progressive' });
    expect(result.score).toBe(4);
    expect(result.category).toBe('SURGICAL');
    expect(codes(result)[0]).toBe('A_PROGRESSIVE_WEAKNESS');
  });

  it('second opinion after surgery was advised is A, never D', () => {
    // The SOP's carve-out: do not auto-reject a second opinion sought for
    // surgical evaluation after surgery has been advised.
    const result = run({
      surgery_advised: 'yes',
      consult_reason: 'second_opinion',
    });
    expect(result.category).toBe('SURGICAL');
    expect(codes(result)).not.toContain('D_SECOND_OPINION_NO_ADVICE');
    expect(result.secondaryNotes.join(' ')).toMatch(
      /potentially appropriate surgical consultation/i,
    );
  });
});

describe('unmatched fallback', () => {
  it('lands in REVIEW when a rule set has no score bands', () => {
    const withoutBands = rulesV2.filter(
      (r) => !['A_SCORE', 'B_SCORE', 'C_SCORE'].includes(r.code),
    );
    const result = evaluateRules(withoutBands, { ...base, ...clean });
    expect(result.unmatched).toBe(true);
    expect(result.category).toBe('REVIEW');
    expect(result.pathway).toMatch(/no category rule matched/i);
  });
});

describe('advisory notes', () => {
  it('adds an imaging note without changing the category', () => {
    const result = run({ has_imaging: 'yes' });
    expect(codes(result)).not.toContain('ADVISORY_IMAGING_AVAILABLE');
    expect(result.secondaryNotes.join(' ')).toMatch(/report and images/i);
    expect(result.category).toBe('ROUTINE');
  });

  it('adds a note when the advised surgery is named', () => {
    const result = run({
      surgery_advised: 'yes',
      surgery_advised_detail: 'Fusion at L5-S1',
    });
    expect(result.secondaryNotes.join(' ')).toMatch(/named the surgery/i);
  });

  it('flags stable weakness, which the table does not score', () => {
    const result = run({ weakness: 'stable' });
    expect(result.score).toBe(0);
    expect(result.secondaryNotes.join(' ')).toMatch(
      /stable arm\/leg weakness/i,
    );
  });

  it('flags an injury without neurological symptoms', () => {
    const result = run({ main_problem: ['back_pain', 'injury'] });
    expect(result.category).not.toBe('URGENT');
    expect(result.secondaryNotes.join(' ')).toMatch(/how recent/i);
  });

  it('flags a previous patient', () => {
    const result = run({ previous_patient: 'yes' });
    expect(result.secondaryNotes.join(' ')).toMatch(/previous patient/i);
  });
});

describe('red-flag reporting', () => {
  it('reports the neurological screen with the answer wording', () => {
    const flags = redFlagsFromSchema(questionnaireV2, {
      ...base,
      ...clean,
      weakness: 'progressive',
    });
    expect(flags.map((f) => [f.key, f.answer])).toEqual([
      ['weakness', 'Yes – progressively increasing'],
      ['walking_balance', 'No'],
    ]);
  });

  it('reports both as No for a clean patient', () => {
    const flags = redFlagsFromSchema(questionnaireV2, { ...base, ...clean });
    expect(flags.every((f) => f.answer === 'No')).toBe(true);
  });
});
