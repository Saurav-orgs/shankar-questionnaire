import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QuestionnaireVersion } from '../models';
import { CopyTokens, LocalizedSchema, localizeSchema } from './localize';
import type { Lang } from './types';

@Injectable()
export class QuestionnaireService {
  constructor(
    @InjectModel(QuestionnaireVersion)
    private readonly versions: typeof QuestionnaireVersion,
  ) {}

  async getPublished(): Promise<QuestionnaireVersion> {
    const version = await this.versions.findOne({
      where: { status: 'published' },
    });

    if (!version) {
      throw new NotFoundException(
        'No published questionnaire. Run `npm run seed` in api/.',
      );
    }
    return version;
  }

  async getById(id: string): Promise<QuestionnaireVersion> {
    const version = await this.versions.findByPk(id);
    if (!version) throw new NotFoundException('Questionnaire version not found.');
    return version;
  }

  async getLocalized(lang: Lang, tokens: CopyTokens): Promise<LocalizedSchema> {
    const version = await this.getPublished();
    return localizeSchema(version.schema, lang, tokens);
  }
}
