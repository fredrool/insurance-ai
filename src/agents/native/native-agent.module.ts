import { Module } from '@nestjs/common';
import { NativeAgentService } from './native-agent.service.js';
import { InsuranceModule } from '../../insurance/insurance.module.js';

@Module({
  imports: [InsuranceModule],
  providers: [NativeAgentService],
  exports: [NativeAgentService],
})
export class NativeAgentModule {}
