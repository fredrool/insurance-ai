import { Module } from '@nestjs/common';
import { InsuranceModule } from '../../insurance/insurance.module.js';
import { BedrockAgentService } from './bedrock-agent.service.js';
import { BedrockAgentController } from './bedrock-agent.controller.js';

@Module({
  imports: [InsuranceModule],
  controllers: [BedrockAgentController],
  providers: [BedrockAgentService],
})
export class BedrockAgentModule {}