import { Module } from '@nestjs/common';
import { RagModule } from '../../rag/rag.module.js';
import { BedrockAgentService } from './bedrock-agent.service.js';
import { BedrockAgentController } from './bedrock-agent.controller.js';
import { InsuranceMcpService } from './insurance-mcp.service.js';

@Module({
  imports: [RagModule],
  controllers: [BedrockAgentController],
  providers: [InsuranceMcpService, BedrockAgentService],
})
export class BedrockAgentModule {}