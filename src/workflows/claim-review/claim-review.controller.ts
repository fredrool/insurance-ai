import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { ClaimReviewWorkflowService } from './claim-review.service.js';
import type {
  ClaimReviewRequest,
  ClaimReviewResumeRequest,
} from './claim-review.types.js';

@Controller('workflows/claim-review')
export class ClaimReviewController {
  constructor(private readonly workflow: ClaimReviewWorkflowService) {}

  @Post()
  async start(@Body() body: ClaimReviewRequest) {
    if (!body.claimId?.trim()) {
      throw new BadRequestException('claimId is required');
    }
    if (!body.question?.trim()) {
      throw new BadRequestException('question is required');
    }

    return this.workflow.start({
      claimId: body.claimId,
      question: body.question,
    });
  }

  @Post('resume')
  async resume(@Body() body: ClaimReviewResumeRequest) {
    if (!body.threadId?.trim()) {
      throw new BadRequestException('threadId is required');
    }
    if (typeof body.approved !== 'boolean') {
      throw new BadRequestException('approved must be a boolean');
    }

    return this.workflow.resume({
      threadId: body.threadId,
      approved: body.approved,
      comment: body.comment,
    });
  }
}