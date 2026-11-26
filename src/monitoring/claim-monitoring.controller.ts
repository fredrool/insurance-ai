import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { ClaimMonitoringAgent } from './claim-monitoring.agent.js';
import {
  monitoringClaimInputSchema,
  type ClaimAssessmentResponse,
} from './claim-monitoring.types.js';

const EDUCATIONAL_NOTICE =
  'Educational assessment only — not a binding compliance or coverage determination.';

@Controller('monitoring')
export class ClaimMonitoringController {
  constructor(private readonly monitoringAgent: ClaimMonitoringAgent) {}

  @Post('claims')
  async evaluateClaim(@Body() body: unknown): Promise<ClaimAssessmentResponse> {
    const parsed = monitoringClaimInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const assessment = await this.monitoringAgent.onClaim(parsed.data);
    return {
      assessment,
      educationalNotice: EDUCATIONAL_NOTICE,
    };
  }
}