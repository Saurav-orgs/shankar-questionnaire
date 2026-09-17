import { QueryTypes } from 'sequelize';
import { questionnaireV1, rulesV1 } from '../questionnaire/v1';
import { validateQuestionnaire } from '../questionnaire/validate';
import { createCliSequelize } from './sequelize-instance';

/**
 * Idempotent seed: one doctor, one published questionnaire version.
 * Safe to re-run — it updates in place rather than duplicating.
 */
const DOCTOR = {
  fullName: 'Dr. Shankar Acharya',
  qualifications: 'MS (Orth), Fellowship in Spine Surgery',
  specialty: 'Spine Surgery',
  bioEn:
    'Senior spine surgeon with over 20 years of experience in degenerative, traumatic and deformity spine care.',
  bioHi:
    'रीढ़ की सर्जरी में 20 वर्षों से अधिक अनुभव वाले वरिष्ठ स्पाइन सर्जन।',
  clinicName: 'Sir Ganga Ram Hospital',
  clinicAddress: 'Sir Ganga Ram Hospital (SGRH), Rajinder Nagar, New Delhi, India',
  clinicPhone: '+91 00000 00000',
  emergencyPhone: '+91 00000 00000',
};

async function main(): Promise<void> {
  const problems = validateQuestionnaire(questionnaireV1, rulesV1);
  if (problems.length) {
    console.error(`Questionnaire failed validation (${problems.length} problems):`);
    problems.forEach((problem) => console.error(`  - ${problem}`));
    process.exitCode = 1;
    return;
  }
  console.log('Questionnaire validation passed.');

  const sequelize = createCliSequelize();

  try {
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

    console.log(
      doctor ? `Created doctor ${doctorId}` : `Doctor already present (${doctorId})`,
    );

    // A published version is immutable in principle, but during the POC the
    // question wording will change constantly, so re-seeding overwrites v1
    // rather than forcing a new version for every typo fix.
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
          version: questionnaireV1.version,
          schema: JSON.stringify(questionnaireV1),
          rules: JSON.stringify(rulesV1),
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
        replacements: { version: questionnaireV1.version },
        type: QueryTypes.SELECT,
      },
    );

    console.log(
      `Published questionnaire v${questionnaireV1.version}: ` +
        `${counts.questions} questions, ${counts.rules} rules.`,
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

void main();
