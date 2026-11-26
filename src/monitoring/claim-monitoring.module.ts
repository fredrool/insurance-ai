import { Module } from '@nestjs/common';

import { ClaimMonitoringAgent } from './claim-monitoring.agent.js';
import { ClaimMonitoringController } from './claim-monitoring.controller.js';

@Module({
  controllers: [ClaimMonitoringController],
  providers: [ClaimMonitoringAgent],
})
export class ClaimMonitoringModule {}