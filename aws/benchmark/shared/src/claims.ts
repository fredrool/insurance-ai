/** Fictional claims/policy data — kept in sync with `src/insurance/insurance.service.ts`. */

export interface InsurancePolicy {
  id: string;
  type: 'home' | 'auto';
  status: 'active' | 'expired';
  coverages: string[];
}

export interface InsuranceClaim {
  id: string;
  policyId: string;
  description: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  submittedAt: string;
}

const POLICIES: InsurancePolicy[] = [
  {
    id: 'POL-001',
    type: 'home',
    status: 'active',
    coverages: ['fire', 'theft', 'water_damage'],
  },
  {
    id: 'POL-002',
    type: 'auto',
    status: 'active',
    coverages: ['collision', 'liability'],
  },
];

const CLAIMS: InsuranceClaim[] = [
  {
    id: 'CLM-001',
    policyId: 'POL-001',
    description: 'Water damage in basement',
    status: 'under_review',
    submittedAt: '2026-10-15',
  },
  {
    id: 'CLM-002',
    policyId: 'POL-002',
    description: 'Collision with another vehicle',
    status: 'approved',
    submittedAt: '2026-10-20',
  },
];

export function getPolicyDetails(policyId: string): InsurancePolicy | null {
  return POLICIES.find((policy) => policy.id === policyId) ?? null;
}

export function getClaimStatus(claimId: string): InsuranceClaim | null {
  return CLAIMS.find((claim) => claim.id === claimId) ?? null;
}