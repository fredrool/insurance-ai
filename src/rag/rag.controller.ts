import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { RagService } from './rag.service.js';
import type { RagAskResponse } from './rag.types.js';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('ask')
  async ask(
    @Body('question') question: unknown,
    @Body('documentNames') documentNames: unknown,
  ): Promise<RagAskResponse> {
    if (typeof question !== 'string' || !question.trim()) {
      throw new BadRequestException('question is required');
    }

    let names: string[] | undefined;

    if (documentNames !== undefined && documentNames !== null) {
      if (!Array.isArray(documentNames)) {
        throw new BadRequestException(
          'documentNames must be an array of strings',
        );
      }

      names = documentNames.map((name) => {
        if (typeof name !== 'string' || !name.trim()) {
          throw new BadRequestException(
            'documentNames must contain non-empty strings',
          );
        }
        return name.trim();
      });
    }

    return this.ragService.ask(question.trim(), names);
  }
}
