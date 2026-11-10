import { Module } from '@nestjs/common';
import { InsuranceModule } from '../../insurance/insurance.module.js';
import { RagModule } from '../../rag/rag.module.js';
import { BedrockAgentService } from './bedrock-agent.service.js';
import { BedrockAgentController } from './bedrock-agent.controller.js';

@Module({
  imports: [InsuranceModule, RagModule],
  controllers: [BedrockAgentController],
  providers: [BedrockAgentService],
})
export class BedrockAgentModule {}