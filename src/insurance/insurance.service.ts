import { Injectable } from '@nestjs/common';
import {
  InsurancePolicy,
  InsuranceClaim,
} from './insurance.types.js';

@Injectable()
export class InsuranceService {
  private readonly policies: InsurancePolicy[] = [
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

  private readonly claims: InsuranceClaim[] = [
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

  getPolicyDetails(policyId: string): InsurancePolicy | null {
    return this.policies.find((policy) => policy.id === policyId) ?? null;
  }

  getClaimStatus(claimId: string): InsuranceClaim | null {
    return this.claims.find((claim) => claim.id === claimId) ?? null;
  }
}