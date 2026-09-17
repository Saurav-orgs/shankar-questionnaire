/**
 * Shared evaluator fixtures.
 *
 * DUPLICATED FILE. The twin lives at:
 *   patient-web/src/questionnaire/evaluator.fixtures.ts
 *
 * Both copies are asserted by their own test suite. If someone edits one
 * evaluator without the other, these cases fail on the side that drifted.
 */

import type { Condition, EvaluationContext } from './types';

export interface ConditionCase {
  name: string;
  condition: Condition;
  context: EvaluationContext;
  expected: boolean;
}

export const conditionCases: ConditionCase[] = [
  /* ---- eq / neq ---- */
  {
    name: 'eq matches',
    condition: { q: 'lbp_radiate', op: 'eq', value: 'below_knee' },
    context: { lbp_radiate: 'below_knee' },
    expected: true,
  },
  {
    name: 'eq does not match a different value',
    condition: { q: 'lbp_radiate', op: 'eq', value: 'below_knee' },
    context: { lbp_radiate: 'buttock' },
    expected: false,
  },
  {
    name: 'eq is false when unanswered',
    condition: { q: 'lbp_radiate', op: 'eq', value: 'below_knee' },
    context: {},
    expected: false,
  },
  {
    name: 'neq is false when unanswered — unknown is not "not equal"',
    condition: { q: 'rf_fever', op: 'neq', value: 'yes' },
    context: {},
    expected: false,
  },
  {
    name: 'neq matches a different answer',
    condition: { q: 'rf_fever', op: 'neq', value: 'yes' },
    context: { rf_fever: 'no' },
    expected: true,
  },

  /* ---- in / not_in ---- */
  {
    name: 'in matches one of several',
    condition: { q: 'lbp_duration', op: 'in', value: ['6w_3m', '3_12m', 'gt_1y'] },
    context: { lbp_duration: '3_12m' },
    expected: true,
  },
  {
    name: 'in is false when unanswered',
    condition: { q: 'lbp_duration', op: 'in', value: ['6w_3m'] },
    context: {},
    expected: false,
  },
  {
    name: 'not_in excludes a listed value',
    condition: { q: 'lbp_walk_distance', op: 'not_in', value: ['unlimited'] },
    context: { lbp_walk_distance: 'lt_100m' },
    expected: true,
  },
  {
    name: 'not_in is false when the value is listed',
    condition: { q: 'lbp_walk_distance', op: 'not_in', value: ['unlimited'] },
    context: { lbp_walk_distance: 'unlimited' },
    expected: false,
  },

  /* ---- includes / excludes on multi-select ---- */
  {
    name: 'includes matches any of the listed codes',
    condition: {
      q: 'chief_complaint',
      op: 'includes',
      value: ['low_back_pain', 'leg_pain'],
    },
    context: { chief_complaint: ['neck_pain', 'leg_pain'] },
    expected: true,
  },
  {
    name: 'includes is false when none are selected',
    condition: {
      q: 'chief_complaint',
      op: 'includes',
      value: ['low_back_pain', 'leg_pain'],
    },
    context: { chief_complaint: ['neck_pain'] },
    expected: false,
  },
  {
    name: 'includes is false on an empty selection',
    condition: { q: 'chief_complaint', op: 'includes', value: ['leg_pain'] },
    context: { chief_complaint: [] },
    expected: false,
  },
  {
    name: 'excludes is true when none of the codes are present',
    condition: { q: 'tx_tried', op: 'excludes', value: ['physio', 'surgery'] },
    context: { tx_tried: ['rest', 'painkillers'] },
    expected: true,
  },
  {
    name: 'excludes is false when one of the codes is present',
    condition: { q: 'tx_tried', op: 'excludes', value: ['physio', 'surgery'] },
    context: { tx_tried: ['rest', 'physio'] },
    expected: false,
  },
  {
    name: 'excludes is false when unanswered — absence of data is not absence of treatment',
    condition: { q: 'tx_tried', op: 'excludes', value: ['physio'] },
    context: {},
    expected: false,
  },

  /* ---- numeric ---- */
  {
    name: 'gte matches at the boundary',
    condition: { q: 'age', op: 'gte', value: 50 },
    context: { age: 50 },
    expected: true,
  },
  {
    name: 'gte is false below the boundary',
    condition: { q: 'age', op: 'gte', value: 50 },
    context: { age: 49 },
    expected: false,
  },
  {
    name: 'lte matches at the boundary',
    condition: { q: 'age', op: 'lte', value: 44 },
    context: { age: 44 },
    expected: true,
  },
  {
    name: 'numeric comparison parses a numeric string',
    condition: { q: 'lbp_severity', op: 'gte', value: 7 },
    context: { lbp_severity: '8' },
    expected: true,
  },
  {
    name: 'numeric comparison is false on a missing value',
    condition: { q: 'age', op: 'gte', value: 50 },
    context: {},
    expected: false,
  },
  {
    name: 'zero is a real answer, not a blank',
    condition: { q: 'lbp_severity', op: 'lte', value: 2 },
    context: { lbp_severity: 0 },
    expected: true,
  },

  /* ---- answered / unanswered ---- */
  {
    name: 'answered is false for an empty string',
    condition: { q: 'free_text', op: 'answered' },
    context: { free_text: '   ' },
    expected: false,
  },
  {
    name: 'answered is true for real text',
    condition: { q: 'free_text', op: 'answered' },
    context: { free_text: 'I also have knee pain' },
    expected: true,
  },
  {
    name: 'unanswered is true for a missing key',
    condition: { q: 'free_text', op: 'unanswered' },
    context: {},
    expected: true,
  },

  /* ---- combinators ---- */
  {
    name: 'all requires every child',
    condition: {
      all: [
        { q: 'lbp_radiate', op: 'eq', value: 'below_knee' },
        { q: 'lbp_numbness', op: 'eq', value: 'yes' },
      ],
    },
    context: { lbp_radiate: 'below_knee', lbp_numbness: 'no' },
    expected: false,
  },
  {
    name: 'any requires one child',
    condition: {
      any: [
        { q: 'rf_bladder', op: 'in', value: ['yes', 'unsure'] },
        { q: 'rf_bowel', op: 'in', value: ['yes', 'unsure'] },
      ],
    },
    context: { rf_bladder: 'no', rf_bowel: 'unsure' },
    expected: true,
  },
  {
    name: 'not inverts',
    condition: { not: { q: 'rf_trauma', op: 'eq', value: 'yes' } },
    context: { rf_trauma: 'no' },
    expected: true,
  },
  {
    name: 'not on an unanswered question passes — used as a GREY guard',
    condition: { not: { q: 'lbp_weakness', op: 'eq', value: 'yes' } },
    context: {},
    expected: true,
  },
  {
    name: 'nested combinators',
    condition: {
      all: [
        { q: 'rf_fever', op: 'eq', value: 'yes' },
        {
          any: [
            { q: 'comorbidities', op: 'includes', value: ['diabetes'] },
            { q: 'rf_night_pain', op: 'eq', value: 'yes' },
          ],
        },
      ],
    },
    context: {
      rf_fever: 'yes',
      comorbidities: ['none'],
      rf_night_pain: 'yes',
    },
    expected: true,
  },
];
