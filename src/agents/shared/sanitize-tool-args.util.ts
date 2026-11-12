export function sanitizeLoggedArgs(
  toolName: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  switch (toolName) {
    case 'searchInsuranceDocuments':
      return {
        query: args.query,
        documentNames: args.documentNames,
        topK: args.topK,
      };
    case 'getClaimStatus':
    case 'claims_getClaimStatus':
      return { claimId: args.claimId };
    case 'getPolicyDetails':
    case 'claims_getPolicyDetails':
      return { policyId: args.policyId };
    case 'crm_getCustomerDetails':
      return { customerId: args.customerId };
    case 'crm_getCustomerByPolicy':
      return { policyId: args.policyId };
    default:
      return args;
  }
}
