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
      return { claimId: args.claimId };
    case 'getPolicyDetails':
      return { policyId: args.policyId };
    default:
      return args;
  }
}
