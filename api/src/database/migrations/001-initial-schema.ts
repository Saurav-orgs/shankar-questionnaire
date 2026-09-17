import type { MigrationParams } from 'umzug';
import type { MigrationContext } from '../migrator';

/**
 * Initial schema.
 *
 * Status/category columns use CHECK constraints rather than Postgres ENUM
 * types. The clinical vocabulary here is expected to churn while the doctor
 * reviews it, and altering a CHECK is a one-line migration where altering an
 * ENUM is not.
 */
export async function up({
  context,
}: MigrationParams<MigrationContext>): Promise<void> {
  await context.query(`
    CREATE TABLE doctors (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name        text NOT NULL,
      qualifications   text,
      specialty        text,
      bio_en           text,
      bio_hi           text,
      photo_url        text,
      clinic_name      text,
      clinic_address   text,
      clinic_phone     text,
      emergency_phone  text,
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now()
    );
  `);

  await context.query(`
    CREATE TABLE questionnaire_versions (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      version       integer NOT NULL UNIQUE,
      schema        jsonb NOT NULL,
      rules         jsonb NOT NULL,
      status        text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'archived')),
      published_at  timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Only one version may be published at a time.
  await context.query(`
    CREATE UNIQUE INDEX questionnaire_versions_single_published
      ON questionnaire_versions ((status))
      WHERE status = 'published';
  `);

  await context.query(`
    CREATE TABLE assessments (
      id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      public_token              text NOT NULL UNIQUE,
      doctor_id                 uuid NOT NULL REFERENCES doctors(id),
      questionnaire_version_id  uuid NOT NULL REFERENCES questionnaire_versions(id),
      language                  text NOT NULL DEFAULT 'en'
                                CHECK (language IN ('en', 'hi')),
      status                    text NOT NULL DEFAULT 'in_progress'
                                CHECK (status IN ('in_progress', 'submitted', 'abandoned')),
      consent_at                timestamptz,
      patient_name              text,
      patient_age               integer CHECK (patient_age BETWEEN 1 AND 120),
      patient_gender            text CHECK (patient_gender IN ('male', 'female', 'other')),
      patient_mobile            text,
      patient_occupation        text,
      patient_city              text,
      answers                   jsonb NOT NULL DEFAULT '{}'::jsonb,
      current_question_key      text,
      emergency_triggered       boolean NOT NULL DEFAULT false,
      started_at                timestamptz NOT NULL DEFAULT now(),
      submitted_at              timestamptz,
      last_activity_at          timestamptz NOT NULL DEFAULT now(),
      created_at                timestamptz NOT NULL DEFAULT now(),
      updated_at                timestamptz NOT NULL DEFAULT now()
    );
  `);

  await context.query(`
    CREATE INDEX assessments_status_submitted_at
      ON assessments (status, submitted_at DESC);
  `);
  await context.query(`
    CREATE INDEX assessments_doctor_id ON assessments (doctor_id);
  `);
  // Duplicate-submission detection: the same person filling the form twice
  // should not occupy two rows of the doctor's attention.
  await context.query(`
    CREATE INDEX assessments_patient_mobile ON assessments (patient_mobile)
      WHERE patient_mobile IS NOT NULL;
  `);

  await context.query(`
    CREATE TABLE triage_results (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id    uuid NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE,
      category         text NOT NULL CHECK (category IN ('RED', 'AMBER', 'GREY', 'GREEN')),
      urgency          text NOT NULL
                       CHECK (urgency IN ('emergency', 'urgent', 'routine', 'non_urgent')),
      pathway          text NOT NULL,
      matched_rules    jsonb NOT NULL DEFAULT '[]'::jsonb,
      red_flags        jsonb NOT NULL DEFAULT '[]'::jsonb,
      secondary_notes  jsonb NOT NULL DEFAULT '[]'::jsonb,
      contradictions   jsonb NOT NULL DEFAULT '[]'::jsonb,
      unmatched        boolean NOT NULL DEFAULT false,
      completeness     numeric(4,3),
      summary_text     text,
      summary_source   text CHECK (summary_source IN ('ai', 'template')),
      model            text,
      prompt_version   text,
      generated_at     timestamptz NOT NULL DEFAULT now(),
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now()
    );
  `);

  await context.query(`
    CREATE INDEX triage_results_category ON triage_results (category);
  `);

  await context.query(`
    CREATE TABLE doctor_reviews (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id       uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      decision            text NOT NULL CHECK (decision IN (
                            'accept_consult',
                            'route_physio',
                            'route_other_specialty',
                            'request_more_info',
                            'decline'
                          )),
      route_to            text,
      agreed_with_triage  boolean,
      notes               text,
      reviewed_by         text,
      reviewed_at         timestamptz NOT NULL DEFAULT now(),
      created_at          timestamptz NOT NULL DEFAULT now(),
      updated_at          timestamptz NOT NULL DEFAULT now()
    );
  `);

  await context.query(`
    CREATE INDEX doctor_reviews_assessment_id ON doctor_reviews (assessment_id);
  `);

  await context.query(`
    CREATE TABLE audit_logs (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor       text,
      action      text NOT NULL,
      entity      text,
      entity_id   uuid,
      ip          text,
      user_agent  text,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `);

  await context.query(`
    CREATE INDEX audit_logs_entity ON audit_logs (entity, entity_id);
  `);
  await context.query(`
    CREATE INDEX audit_logs_created_at ON audit_logs (created_at DESC);
  `);
}

export async function down({
  context,
}: MigrationParams<MigrationContext>): Promise<void> {
  await context.query('DROP TABLE IF EXISTS audit_logs;');
  await context.query('DROP TABLE IF EXISTS doctor_reviews;');
  await context.query('DROP TABLE IF EXISTS triage_results;');
  await context.query('DROP TABLE IF EXISTS assessments;');
  await context.query('DROP TABLE IF EXISTS questionnaire_versions;');
  await context.query('DROP TABLE IF EXISTS doctors;');
}
