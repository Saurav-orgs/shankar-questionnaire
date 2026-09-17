import type { QuestionnaireSchema, TriageRule } from '../types';
import { completionScreen, consent, disclaimer, emergencyScreen } from './copy';
import { questions, sections } from './questions';
import { rules } from './rules';

export const QUESTIONNAIRE_VERSION = 1;

export const questionnaireV1: QuestionnaireSchema = {
  version: QUESTIONNAIRE_VERSION,
  sections,
  questions,
  consent,
  emergencyScreen,
  completionScreen,
  disclaimer,
};

export const rulesV1: TriageRule[] = rules;
