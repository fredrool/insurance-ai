import { Module } from '@nestjs/common';
import { RagModule } from '../../rag/rag.module.js';
import { BedrockAgentService } from './bedrock-agent.service.js';
import { BedrockAgentController } from './bedrock-agent.controller.js';
import { ClaimsMcpService } from './claims-mcp.service.js';

@Module({
  imports: [RagModule],
  controllers: [BedrockAgentController],
  providers: [ClaimsMcpService, BedrockAgentService],
})
export class BedrockAgentModule {}