import { Module } from '@nestjs/common';
import { NativeAgentService } from './native-agent.service.js';
import { InsuranceModule } from '../../insurance/insurance.module.js';
import { RagModule } from '../../rag/rag.module.js';

@Module({
  imports: [InsuranceModule, RagModule],
  providers: [NativeAgentService],
  exports: [NativeAgentService],
})
export class NativeAgentModule {}
