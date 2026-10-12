import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { buildEvaluationContext } from '../assessments/assessments.service';
import { Assessment, QuestionnaireVersion } from '../models';
import { TriageService } from '../triage/triage.service';

/**
 * Re-runs triage for every submitted assessment against the rules currently
 * stored with its questionnaire version. Run after `npm run seed` whenever
 * the rules change — a stored verdict is a snapshot, and the doctor should
 * not be looking at yesterday's logic on today's dashboard.
 *
 *   npm run retriage            # every submitted assessment
 *   npm run retriage -- 2       # only assessments on questionnaire v2
 */
async function main() {
  const onlyVersion = process.argv[2] ? Number(process.argv[2]) : null;
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });

  try {
    const triage = app.get(TriageService);
    const assessments = await Assessment.findAll({
      where: { status: 'submitted' },
      include: [{ model: QuestionnaireVersion }],
      order: [['submittedAt', 'ASC']],
    });

    let done = 0;
    for (const assessment of assessments) {
      const version = assessment.questionnaireVersion;
      if (!version) continue;
      if (onlyVersion !== null && version.version !== onlyVersion) continue;

      const result = await triage.evaluateAndStore(
        assessment,
        version.schema,
        version.rules,
        buildEvaluationContext(assessment),
      );
      done += 1;
      console.log(
        `${(assessment.patientName ?? '—').padEnd(24)} v${version.version}  ${result.category.padEnd(11)} score ${String(result.score ?? '—').padStart(3)}  ${result.summarySource}`,
      );
    }
    console.log(`\nRe-triaged ${done} of ${assessments.length} submitted assessments.`);
  } finally {
    await app.close();
  }
}

void main();
