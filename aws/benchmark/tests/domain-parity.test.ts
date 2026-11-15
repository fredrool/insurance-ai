import { describe, expect, it } from 'vitest';

import { InsuranceService } from '../../../src/insurance/insurance.service.js';
import { getClaimStatus, getPolicyDetails } from '../shared/src/claims.js';
import {
  getCustomerByPolicy,
  getCustomerDetails,
} from '../shared/src/crm.js';
import {
  getCustomerByPolicy as localGetCustomerByPolicy,
  getCustomerDetails as localGetCustomerDetails,
} from '../../../mcp/crm/crm.data.js';

describe('benchmark domain parity with local MCP fixtures', () => {
  const insurance = new InsuranceService();

  it('matches Nest InsuranceService for claims and policies', () => {
    expect(getClaimStatus('CLM-001')).toEqual(
      insurance.getClaimStatus('CLM-001'),
    );
    expect(getPolicyDetails('POL-001')).toEqual(
      insurance.getPolicyDetails('POL-001'),
    );
  });

  it('matches local CRM MCP data module', () => {
    expect(getCustomerDetails('CUS-1001')).toEqual(
      localGetCustomerDetails('CUS-1001'),
    );
    expect(getCustomerByPolicy('POL-001')).toEqual(
      localGetCustomerByPolicy('POL-001'),
    );
  });
});