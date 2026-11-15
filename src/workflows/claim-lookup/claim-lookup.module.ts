import { Module } from '@nestjs/common';

import { BedrockAgentModule } from '../../agents/bedrock/bedrock-agent.module.js';
import { RagModule } from '../../rag/rag.module.js';
import { ClaimLookupController } from './claim-lookup.controller.js';
import { ClaimLookupWorkflowService } from './claim-lookup.service.js';

@Module({
  imports: [RagModule, BedrockAgentModule],
  controllers: [ClaimLookupController],
  providers: [ClaimLookupWorkflowService],
})
export class ClaimLookupModule {}