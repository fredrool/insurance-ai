import { Module } from '@nestjs/common';
import { InsuranceService } from './insurance.service.js';

@Module({
  providers: [InsuranceService],
  exports: [InsuranceService],
})
export class InsuranceModule {}