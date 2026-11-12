import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';

import { InsuranceMcpService } from './insurance-mcp.service.js';

describe('Bedrock MCP integration (live stdio)', () => {
  let mcp: InsuranceMcpService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InsuranceMcpService],
    }).compile();

    mcp = module.get(InsuranceMcpService);
    await mcp.onModuleInit();
  }, 30_000);

  afterAll(async () => {
    await mcp.onModuleDestroy();
  });

  it('loads a claim from Claims MCP then resolves CRM customer by shared policyId', async () => {
    const claimTool = mcp
      .getTools()
      .find((tool) => tool.name === 'claims_getClaimStatus');
    const crmTool = mcp
      .getTools()
      .find((tool) => tool.name === 'crm_getCustomerByPolicy');

    expect(claimTool).toBeDefined();
    expect(crmTool).toBeDefined();

    const claimRaw = await claimTool!.invoke({ claimId: 'CLM-001' });
    const claim = JSON.parse(String(claimRaw));
    expect(claim?.policyId).toBe('POL-001');

    const customerRaw = await crmTool!.invoke({
      policyId: claim.policyId,
    });
    const customer = JSON.parse(String(customerRaw));
    expect(customer?.id).toBe('CUS-1001');
    expect(customer?.policyIds).toContain('POL-001');
  }, 30_000);
});
