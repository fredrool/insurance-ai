import { z } from 'zod';

export const monitoringRuleIds = [
  'HIGH_CLAIM_AMOUNT',
  'LATE_SUBMISSION',
  'MISSING_POLICY',
  'CONTRADICTORY_INFORMATION',
] as const;

export type MonitoringRuleId = (typeof monitoringRuleIds)[number];

export const monitoringClaimInputSchema = z.object({
  claimId: z.string().trim().min(1),
  policyId: z.string().trim().min(1).optional(),
  amount: z.number().finite().nonnegative(),
  currency: z.string().trim().min(1).default('CAD'),
  incidentDate: z.string().trim().min(1),
  submittedAt: z.string().trim().min(1),
  description: z.string().trim().min(1),
});

export type MonitoringClaimInput = z.infer<typeof monitoringClaimInputSchema>;

export const claimViolationSchema = z.object({
  ruleId: z.enum(monitoringRuleIds),
  explanation: z.string().min(1),
  requiresHumanReview: z.boolean(),
});

export const claimAssessmentSchema = z.object({
  claimId: z.string().min(1),
  compliant: z.boolean(),
  violations: z.array(claimViolationSchema),
  summary: z.string().min(1),
});

export type ClaimViolation = z.infer<typeof claimViolationSchema>;
export type ClaimAssessment = z.infer<typeof claimAssessmentSchema>;

export interface ClaimAssessmentResponse {
  assessment: ClaimAssessment;
  educationalNotice: string;
}