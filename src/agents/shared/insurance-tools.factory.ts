import { tool } from 'langchain';
import { z } from 'zod';
import { InsuranceService } from '../../insurance/insurance.service.js';

export function createInsuranceTools(
  insuranceService: InsuranceService,
) {
  const getClaimStatus = tool(
    async ({ claimId }) =>
      JSON.stringify(insuranceService.getClaimStatus(claimId)),
    {
      name: 'getClaimStatus',
      description: 'Retrieve the status of an insurance claim.',
      schema: z.object({
        claimId: z.string(),
      }),
    },
  );

  const getPolicyDetails = tool(
    async ({ policyId }) =>
      JSON.stringify(insuranceService.getPolicyDetails(policyId)),
    {
      name: 'getPolicyDetails',
      description: 'Retrieve details of an insurance policy.',
      schema: z.object({
        policyId: z.string(),
      }),
    },
  );

  return [getClaimStatus, getPolicyDetails];
}