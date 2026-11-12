import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';

import { InsuranceMcpService } from './insurance-mcp.service.js';

const listToolsetsMock = vi.hoisted(() => vi.fn());
const listToolsMock = vi.hoisted(() => vi.fn());
const closeMock = vi.hoisted(() => vi.fn());
const mcpAdapterCtor = vi.hoisted(() =>
  vi.fn(function MCPAdapter() {
    return {
      listToolsets: listToolsetsMock,
      listTools: listToolsMock,
      close: closeMock,
    };
  }),
);

vi.mock('@langchain/mcp-adapters', () => ({
  MCPAdapter: mcpAdapterCtor,
}));

describe('InsuranceMcpService', () => {
  let service: InsuranceMcpService;

  beforeEach(async () => {
    listToolsetsMock.mockReset();
    listToolsMock.mockReset();
    closeMock.mockReset();
    closeMock.mockResolvedValue(undefined);
    mcpAdapterCtor.mockClear();

    listToolsetsMock.mockResolvedValue({
      claims: [
        { name: 'claims_getClaimStatus' },
        { name: 'claims_getPolicyDetails' },
      ],
      crm: [
        { name: 'crm_getCustomerDetails' },
        { name: 'crm_getCustomerByPolicy' },
      ],
    });
    listToolsMock.mockResolvedValue([
      { name: 'claims_getClaimStatus' },
      { name: 'claims_getPolicyDetails' },
      { name: 'crm_getCustomerDetails' },
      { name: 'crm_getCustomerByPolicy' },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [InsuranceMcpService],
    }).compile();

    service = module.get(InsuranceMcpService);
    await service.onModuleInit();
  });

  it('registers Claims and CRM stdio servers with prefixed tool discovery', () => {
    expect(mcpAdapterCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        prefixToolNameWithServerName: true,
        servers: expect.objectContaining({
          claims: expect.objectContaining({
            transport: 'stdio',
            command: process.execPath,
          }),
          crm: expect.objectContaining({
            transport: 'stdio',
          }),
        }),
      }),
    );
    expect(listToolsetsMock).toHaveBeenCalled();
    expect(listToolsMock).toHaveBeenCalled();
    expect(service.getTools().map((tool) => tool.name)).toEqual([
      'claims_getClaimStatus',
      'claims_getPolicyDetails',
      'crm_getCustomerDetails',
      'crm_getCustomerByPolicy',
    ]);
  });

  it('closes both MCP child processes on shutdown', async () => {
    await service.onModuleDestroy();
    expect(closeMock).toHaveBeenCalled();
    expect(service.getTools()).toEqual([]);
  });
});
