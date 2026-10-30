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