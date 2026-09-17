import type {
  Lang,
  Localized,
  Question,
  QuestionnaireSchema,
  Section,
} from './types';

/** The client receives resolved strings, never the bilingual pairs. */
export interface LocalizedOption {
  code: string;
  label: string;
}

export interface LocalizedQuestion
  extends Omit<
    Question,
    'text' | 'help' | 'options' | 'minLabel' | 'maxLabel'
  > {
  text: string;
  help?: string;
  options?: LocalizedOption[];
  minLabel?: string;
  maxLabel?: string;
}

export interface LocalizedSection extends Omit<Section, 'title'> {
  title: string;
}

export interface LocalizedSchema {
  version: number;
  language: Lang;
  sections: LocalizedSection[];
  questions: LocalizedQuestion[];
  consent: { body: string; checkboxLabel: string };
  emergencyScreen: { heading: string; body: string };
  completionScreen: { heading: string; body: string };
  disclaimer: string;
}

export interface CopyTokens {
  doctorName?: string | null;
  clinicPhone?: string | null;
}

function substitute(text: string, tokens: CopyTokens): string {
  return text
    .replace(/\{\{doctorName\}\}/g, tokens.doctorName ?? 'the doctor')
    .replace(/\{\{clinicPhone\}\}/g, tokens.clinicPhone ?? 'the clinic');
}

function pick(value: Localized, lang: Lang, tokens: CopyTokens): string {
  // Fall back to English if a Hindi string is ever missing, rather than
  // showing the patient an empty question.
  return substitute(value[lang] || value.en, tokens);
}

export function localizeSchema(
  schema: QuestionnaireSchema,
  lang: Lang,
  tokens: CopyTokens = {},
): LocalizedSchema {
  return {
    version: schema.version,
    language: lang,
    sections: schema.sections.map((section) => ({
      key: section.key,
      order: section.order,
      title: pick(section.title, lang, tokens),
    })),
    questions: schema.questions.map((question) => {
      const { text, help, options, minLabel, maxLabel, ...rest } = question;
      return {
        ...rest,
        text: pick(text, lang, tokens),
        ...(help ? { help: pick(help, lang, tokens) } : {}),
        ...(options
          ? {
              options: options.map((option) => ({
                code: option.code,
                label: pick(option.label, lang, tokens),
              })),
            }
          : {}),
        ...(minLabel ? { minLabel: pick(minLabel, lang, tokens) } : {}),
        ...(maxLabel ? { maxLabel: pick(maxLabel, lang, tokens) } : {}),
      };
    }),
    consent: {
      body: pick(schema.consent.body, lang, tokens),
      checkboxLabel: pick(schema.consent.checkboxLabel, lang, tokens),
    },
    emergencyScreen: {
      heading: pick(schema.emergencyScreen.heading, lang, tokens),
      body: pick(schema.emergencyScreen.body, lang, tokens),
    },
    completionScreen: {
      heading: pick(schema.completionScreen.heading, lang, tokens),
      body: pick(schema.completionScreen.body, lang, tokens),
    },
    disclaimer: pick(schema.disclaimer, lang, tokens),
  };
}

/**
 * English-only label lookup for the doctor panel.
 *
 * Answers are stored as codes, so a form completed in Hindi renders in English
 * here with no translation step — this is the payoff for never storing display
 * strings. See plan.md §7.
 */
export interface AnswerLabelLookup {
  questionLabel(key: string): string;
  answerLabel(key: string, value: unknown): string;
}

export function buildLabelLookup(
  schema: QuestionnaireSchema,
): AnswerLabelLookup {
  const byKey = new Map(schema.questions.map((q) => [q.key, q]));

  return {
    questionLabel(key) {
      return byKey.get(key)?.text.en ?? key;
    },
    answerLabel(key, value) {
      const question = byKey.get(key);
      if (value === null || value === undefined) return '—';

      if (!question?.options) return String(value);

      const codes = Array.isArray(value) ? value.map(String) : [String(value)];
      return codes
        .map(
          (code) =>
            question.options?.find((o) => o.code === code)?.label.en ?? code,
        )
        .join(', ');
    },
  };
}
