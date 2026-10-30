import { Module } from '@nestjs/common';
import { AnthropicService } from './anthropic.service.js';
import { InsuranceModule } from '../insurance/insurance.module.js';

@Module({
  providers: [AnthropicService],
  exports: [AnthropicService],
  imports: [InsuranceModule],
})
export class AnthropicModule {}
