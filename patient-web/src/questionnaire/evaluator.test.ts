import { describe, expect, it } from 'vitest'
import { evaluateCondition } from './evaluator'
import { conditionCases } from './evaluator.fixtures'

/**
 * The same fixtures the API asserts against.
 *
 * These files are copied from api/src/questionnaire by scripts/sync-evaluator.sh.
 * If the two evaluators drift, this suite fails on the side that changed —
 * which matters because the client uses branching for instant screen
 * transitions while the server re-validates the same rules on submit. A
 * disagreement between them shows up as a form that refuses to submit.
 */
describe('evaluateCondition (patient-web copy)', () => {
  it.each(conditionCases)('$name', ({ condition, context, expected }) => {
    expect(evaluateCondition(condition, context)).toBe(expected)
  })
})
