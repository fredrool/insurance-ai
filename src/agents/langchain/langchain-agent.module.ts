import { Module } from '@nestjs/common';
import { InsuranceModule } from '../../insurance/insurance.module.js';
import { LangchainAgentService } from './langchain-agent.service.js';
import { LangchainAgentController } from './langchain-agent.controller.js';

@Module({
  imports: [InsuranceModule],
  controllers: [LangchainAgentController],
  providers: [LangchainAgentService],
})
export class LangchainAgentModule {}