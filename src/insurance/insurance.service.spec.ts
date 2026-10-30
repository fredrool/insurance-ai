import { Test, TestingModule } from '@nestjs/testing';
import { InsuranceService } from './insurance.service.js';

describe('InsuranceService', () => {
  let service: InsuranceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InsuranceService],
    }).compile();

    service = module.get(InsuranceService);
  });

  describe('getPolicyDetails', () => {
    it('returns the policy when the id exists', () => {
      expect(service.getPolicyDetails('POL-001')).toEqual({
        id: 'POL-001',
        type: 'home',
        status: 'active',
        coverages: ['fire', 'theft', 'water_damage'],
      });
    });

    it('returns null when the policy does not exist', () => {
      expect(service.getPolicyDetails('POL-999')).toBeNull();
    });
  });

  describe('getClaimStatus', () => {
    it('returns the claim when the id exists', () => {
      expect(service.getClaimStatus('CLM-002')).toEqual({
        id: 'CLM-002',
        policyId: 'POL-002',
        description: 'Collision with another vehicle',
        status: 'approved',
        submittedAt: '2026-10-20',
      });
    });

    it('returns null when the claim does not exist', () => {
      expect(service.getClaimStatus('CLM-999')).toBeNull();
    });
  });
});
