import type { QuestionnaireSchema, TriageRule } from '../types';
import { completionScreen, consent, disclaimer, emergencyScreen } from './copy';
import { questions, sections } from './questions';
import { rules } from './rules';

export const QUESTIONNAIRE_VERSION = 2;

export const questionnaireV2: QuestionnaireSchema = {
  version: QUESTIONNAIRE_VERSION,
  sections,
  questions,
  consent,
  emergencyScreen,
  completionScreen,
  disclaimer,
};

export const rulesV2: TriageRule[] = rules;
