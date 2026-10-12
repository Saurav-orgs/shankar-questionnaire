import { QueryTypes, Sequelize } from 'sequelize';
import { questionnaireV2, rulesV2 } from '../questionnaire/v2';
import { validateQuestionnaire } from '../questionnaire/validate';
import { createCliSequelize } from './sequelize-instance';

/**
 * Idempotent seed: one doctor, one published questionnaire version.
 * Safe to re-run — it updates in place rather than duplicating.
 *
 * Runs from the CLI (`npm run seed`) and from DatabaseBootstrapService on
 * every API start, so a fresh database comes up ready without manual steps.
 */
// Only what the doctor actually supplied — the heading of his paper form and
// its opening line. No invented qualifications or biography.
export const DOCTOR = {
  fullName: 'Dr. Shankar Acharya',
  qualifications: null as string | null,
  specialty: null as string | null,
  bioEn:
    'Dear Patient,\n\nTo help us schedule your appointment appropriately, kindly answer the following:',
  bioHi:
    'प्रिय मरीज़,\n\nआपकी अपॉइंटमेंट सही ढंग से तय करने में हमारी मदद के लिए, कृपया नीचे दिए गए सवालों के जवाब दें:',
  clinicName: 'Sir Ganga Ram Hospital',
  clinicAddress: 'Sir Ganga Ram Hospital (SGRH), Rajinder Nagar, New Delhi, India',
  clinicPhone: '+91 00000 00000',
  emergencyPhone: '+91 00000 00000',
};

export interface SeedLogger {
  log: (message: string) => void;
}

export interface SeedResult {
  doctorId: string;
  doctorCreated: boolean;
  questionnaireVersion: number;
  questions: number;
  rules: number;
}

export async function runSeed(
  sequelize: Sequelize,
  logger: SeedLogger = console,
): Promise<SeedResult> {
  const problems = validateQuestionnaire(questionnaireV2, rulesV2);
  if (problems.length) {
    throw new Error(
      `Questionnaire failed validation (${problems.length} problems):\n` +
        problems.map((problem) => `  - ${problem}`).join('\n'),
    );
  }
  logger.log('Questionnaire validation passed.');

  {
    const [doctor] = await sequelize.query<{ id: string }>(
      `
      INSERT INTO doctors (
        full_name, qualifications, specialty, bio_en, bio_hi,
        clinic_name, clinic_address, clinic_phone, emergency_phone
      )
      SELECT :fullName, :qualifications, :specialty, :bioEn, :bioHi,
             :clinicName, :clinicAddress, :clinicPhone, :emergencyPhone
      WHERE NOT EXISTS (SELECT 1 FROM doctors)
      RETURNING id;
      `,
      { replacements: DOCTOR, type: QueryTypes.SELECT },
    );

    const doctorId =
      doctor?.id ??
      (
        await sequelize.query<{ id: string }>(
          'SELECT id FROM doctors ORDER BY created_at LIMIT 1',
          { type: QueryTypes.SELECT },
        )
      )[0]?.id;

    if (!doctorId) {
      throw new Error('Seed could not create or find a doctor row.');
    }
    logger.log(
      doctor ? `Created doctor ${doctorId}` : `Doctor already present (${doctorId})`,
    );

    // There is no profile editor, so the seed owns the doctor's details: keep
    // an existing row in step with DOCTOR rather than leaving stale copy.
    await sequelize.query(
      `
      UPDATE doctors SET
        full_name = :fullName, qualifications = :qualifications,
        specialty = :specialty, bio_en = :bioEn, bio_hi = :bioHi,
        clinic_name = :clinicName, clinic_address = :clinicAddress,
        clinic_phone = :clinicPhone, emergency_phone = :emergencyPhone,
        updated_at = now()
      WHERE id = :id;
      `,
      { replacements: { ...DOCTOR, id: doctorId } },
    );

    // Only one version may be published at a time (partial unique index), so
    // any older version is archived first. Assessments taken against it keep
    // their own copy of the schema and still render in the doctor panel.
    await sequelize.query(
      `
      UPDATE questionnaire_versions
        SET status = 'archived', updated_at = now()
      WHERE status = 'published' AND version <> :version;
      `,
      { replacements: { version: questionnaireV2.version } },
    );

    // A published version is immutable in principle, but during the POC the
    // question wording will change constantly, so re-seeding overwrites the
    // current version rather than forcing a new one for every typo fix.
    await sequelize.query(
      `
      INSERT INTO questionnaire_versions (version, schema, rules, status, published_at)
      VALUES (:version, CAST(:schema AS jsonb), CAST(:rules AS jsonb), 'published', now())
      ON CONFLICT (version) DO UPDATE
        SET schema = EXCLUDED.schema,
            rules = EXCLUDED.rules,
            status = 'published',
            published_at = now(),
            updated_at = now();
      `,
      {
        replacements: {
          version: questionnaireV2.version,
          schema: JSON.stringify(questionnaireV2),
          rules: JSON.stringify(rulesV2),
        },
      },
    );

    const [counts] = await sequelize.query<{
      questions: number;
      rules: number;
    }>(
      `
      SELECT jsonb_array_length(schema -> 'questions') AS questions,
             jsonb_array_length(rules) AS rules
      FROM questionnaire_versions WHERE version = :version;
      `,
      {
        replacements: { version: questionnaireV2.version },
        type: QueryTypes.SELECT,
      },
    );

    logger.log(
      `Published questionnaire v${questionnaireV2.version}: ` +
        `${counts.questions} questions, ${counts.rules} rules.`,
    );

    return {
      doctorId,
      doctorCreated: Boolean(doctor),
      questionnaireVersion: questionnaireV2.version,
      questions: Number(counts.questions),
      rules: Number(counts.rules),
    };
  }
}

async function main(): Promise<void> {
  const sequelize = createCliSequelize();
  try {
    await runSeed(sequelize);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  void main();
}
