import { Module } from '@nestjs/common';

import { BedrockAgentModule } from '../../agents/bedrock/bedrock-agent.module.js';
import { RagModule } from '../../rag/rag.module.js';
import { ClaimReviewController } from './claim-review.controller.js';
import { ClaimReviewWorkflowService } from './claim-review.service.js';

@Module({
  imports: [RagModule, BedrockAgentModule],
  controllers: [ClaimReviewController],
  providers: [ClaimReviewWorkflowService],
})
export class ClaimReviewModule {}