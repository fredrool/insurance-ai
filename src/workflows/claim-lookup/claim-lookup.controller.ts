import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { ClaimLookupWorkflowService } from './claim-lookup.service.js';
import type { ClaimLookupRequest } from './claim-lookup.types.js';

@Controller('workflows/claim-lookup')
export class ClaimLookupController {
  constructor(
    private readonly workflow: ClaimLookupWorkflowService,
  ) {}

  @Post()
  async run(@Body() body: ClaimLookupRequest) {
    if (!body.claimId?.trim()) {
      throw new BadRequestException('claimId is required');
    }
    if (!body.question?.trim()) {
      throw new BadRequestException('question is required');
    }

    return this.workflow.run({
      claimId: body.claimId,
      question: body.question,
    });
  }
}