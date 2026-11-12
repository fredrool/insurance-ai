import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';

import { ClaimsMcpService } from './claims-mcp.service.js';

const listToolsMock = vi.hoisted(() => vi.fn());
const closeMock = vi.hoisted(() => vi.fn());
const mcpAdapterCtor = vi.hoisted(() =>
  vi.fn(function MCPAdapter() {
    return { listTools: listToolsMock, close: closeMock };
  }),
);

vi.mock('@langchain/mcp-adapters', () => ({
  MCPAdapter: mcpAdapterCtor,
}));

vi.mock('./claims-mcp.launch.js', () => ({
  resolveClaimsMcpServerLaunch: () => ({
    command: '/usr/bin/node',
    args: ['/proj/node_modules/tsx/dist/cli.mjs', '/proj/mcp/claims/server.ts'],
    cwd: '/proj',
  }),
}));

describe('ClaimsMcpService', () => {
  let service: ClaimsMcpService;

  beforeEach(async () => {
    listToolsMock.mockReset();
    closeMock.mockReset();
    closeMock.mockResolvedValue(undefined);
    mcpAdapterCtor.mockClear();
    listToolsMock.mockResolvedValue([
      { name: 'getClaimStatus' },
      { name: 'getPolicyDetails' },
      { name: 'unexpectedTool' },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ClaimsMcpService],
    }).compile();

    service = module.get(ClaimsMcpService);
    await service.onModuleInit();
  });

  it('discovers claims MCP tools via MCPAdapter.listTools', () => {
    expect(mcpAdapterCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        prefixToolNameWithServerName: false,
        servers: expect.objectContaining({
          claims: expect.objectContaining({
            transport: 'stdio',
            command: '/usr/bin/node',
          }),
        }),
      }),
    );
    expect(listToolsMock).toHaveBeenCalledWith('claims');
    expect(service.getTools().map((tool) => tool.name)).toEqual([
      'getClaimStatus',
      'getPolicyDetails',
    ]);
  });

  it('closes the adapter on shutdown', async () => {
    await service.onModuleDestroy();
    expect(closeMock).toHaveBeenCalled();
    expect(service.getTools()).toEqual([]);
  });

  it('logs and rethrows when discovery fails', async () => {
    listToolsMock.mockRejectedValueOnce(new Error('stdio spawn failed'));

    const module = await Test.createTestingModule({
      providers: [ClaimsMcpService],
    }).compile();

    const failing = module.get(ClaimsMcpService);
    await expect(failing.onModuleInit()).rejects.toThrow('stdio spawn failed');
    expect(closeMock).toHaveBeenCalled();
  });
});
