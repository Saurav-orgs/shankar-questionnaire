import type { MigrationParams } from 'umzug';
import type { MigrationContext } from '../migrator';

/**
 * Questionnaire v2 replaces the RED/AMBER/GREY/GREEN bands with the doctor's
 * four scheduling buckets — URGENT / SURGICAL / REVIEW / ROUTINE — and adds a
 * `priority` urgency for the SURGICAL bucket.
 *
 * Existing rows are re-labelled by nearest meaning so old assessments still
 * open in the doctor panel. The old bands do not map one-to-one (old GREEN was
 * "conservative care", old GREY was "not a spine problem" — both are ROUTINE
 * now; old AMBER "spine consult" is REVIEW, since v1 never asked whether
 * surgery had been advised). Their matched_rules JSON keeps the old codes;
 * the doctor panel tolerates unknown codes there.
 */
export async function up({
  context,
}: MigrationParams<MigrationContext>): Promise<void> {
  await context.query(`
    ALTER TABLE triage_results DROP CONSTRAINT IF EXISTS triage_results_category_check;
  `);
  await context.query(`
    ALTER TABLE triage_results DROP CONSTRAINT IF EXISTS triage_results_urgency_check;
  `);

  await context.query(`
    UPDATE triage_results SET category = CASE category
      WHEN 'RED'   THEN 'URGENT'
      WHEN 'AMBER' THEN 'REVIEW'
      WHEN 'GREY'  THEN 'ROUTINE'
      WHEN 'GREEN' THEN 'ROUTINE'
      ELSE category
    END
    WHERE category IN ('RED', 'AMBER', 'GREY', 'GREEN');
  `);

  await context.query(`
    ALTER TABLE triage_results
      ADD CONSTRAINT triage_results_category_check
      CHECK (category IN ('URGENT', 'SURGICAL', 'REVIEW', 'ROUTINE'));
  `);
  await context.query(`
    ALTER TABLE triage_results
      ADD CONSTRAINT triage_results_urgency_check
      CHECK (urgency IN ('emergency', 'urgent', 'priority', 'routine', 'non_urgent'));
  `);
}

export async function down({
  context,
}: MigrationParams<MigrationContext>): Promise<void> {
  await context.query(`
    ALTER TABLE triage_results DROP CONSTRAINT IF EXISTS triage_results_category_check;
  `);
  await context.query(`
    ALTER TABLE triage_results DROP CONSTRAINT IF EXISTS triage_results_urgency_check;
  `);

  await context.query(`
    UPDATE triage_results SET category = CASE category
      WHEN 'URGENT'   THEN 'RED'
      WHEN 'SURGICAL' THEN 'AMBER'
      WHEN 'REVIEW'   THEN 'AMBER'
      WHEN 'ROUTINE'  THEN 'GREEN'
      ELSE category
    END;
  `);
  await context.query(`
    UPDATE triage_results SET urgency = 'routine' WHERE urgency = 'priority';
  `);

  await context.query(`
    ALTER TABLE triage_results
      ADD CONSTRAINT triage_results_category_check
      CHECK (category IN ('RED', 'AMBER', 'GREY', 'GREEN'));
  `);
  await context.query(`
    ALTER TABLE triage_results
      ADD CONSTRAINT triage_results_urgency_check
      CHECK (urgency IN ('emergency', 'urgent', 'routine', 'non_urgent'));
  `);
}
