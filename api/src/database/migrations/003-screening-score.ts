import type { MigrationParams } from 'umzug';
import type { MigrationContext } from '../migrator';

/**
 * Dr. Acharya's screening SOP adds a points score behind every verdict and a
 * fifth category, REPORT_ONLY (his "⚫ D — report-only / second-opinion
 * request"), which was previously folded into REVIEW.
 *
 * Existing rows keep their category; `score` is null until `npm run
 * retriage` recomputes them against the scoring rules.
 */
export async function up({
  context,
}: MigrationParams<MigrationContext>): Promise<void> {
  await context.query(`
    ALTER TABLE triage_results ADD COLUMN IF NOT EXISTS score integer;
  `);
  await context.query(`
    ALTER TABLE triage_results DROP CONSTRAINT IF EXISTS triage_results_category_check;
  `);
  await context.query(`
    ALTER TABLE triage_results
      ADD CONSTRAINT triage_results_category_check
      CHECK (category IN ('URGENT', 'SURGICAL', 'REVIEW', 'ROUTINE', 'REPORT_ONLY'));
  `);
}

export async function down({
  context,
}: MigrationParams<MigrationContext>): Promise<void> {
  await context.query(`
    ALTER TABLE triage_results DROP CONSTRAINT IF EXISTS triage_results_category_check;
  `);
  await context.query(`
    UPDATE triage_results SET category = 'REVIEW' WHERE category = 'REPORT_ONLY';
  `);
  await context.query(`
    ALTER TABLE triage_results
      ADD CONSTRAINT triage_results_category_check
      CHECK (category IN ('URGENT', 'SURGICAL', 'REVIEW', 'ROUTINE'));
  `);
  await context.query(`
    ALTER TABLE triage_results DROP COLUMN IF EXISTS score;
  `);
}
