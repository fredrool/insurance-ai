import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { MCPAdapter } from '@langchain/mcp-adapters';
import type { DynamicStructuredTool } from '@langchain/core/tools';

import { resolveMcpStdioServerLaunch } from './mcp-stdio.launch.js';

const CLAIMS_SERVER_NAME = 'claims';
const CRM_SERVER_NAME = 'crm';

const EXPECTED_TOOLS_BY_SERVER: Record<string, readonly string[]> = {
  [CLAIMS_SERVER_NAME]: ['getClaimStatus', 'getPolicyDetails'],
  [CRM_SERVER_NAME]: ['getCustomerDetails', 'getCustomerByPolicy'],
};

function stdioServer(serverEntryRelativePath: string) {
  const launch = resolveMcpStdioServerLaunch(serverEntryRelativePath);
  return {
    transport: 'stdio' as const,
    command: launch.command,
    args: launch.args,
    cwd: launch.cwd,
  };
}

@Injectable()
export class InsuranceMcpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InsuranceMcpService.name);
  private adapter?: MCPAdapter;
  private tools: DynamicStructuredTool[] = [];

  async onModuleInit(): Promise<void> {
    try {
      this.adapter = new MCPAdapter({
        prefixToolNameWithServerName: true,
        servers: {
          [CLAIMS_SERVER_NAME]: stdioServer('mcp/claims/server.ts'),
          [CRM_SERVER_NAME]: stdioServer('mcp/crm/server.ts'),
        },
      });

      const toolsets = await this.adapter.listToolsets();
      this.assertExpectedTools(toolsets);

      this.tools = await this.adapter.listTools();
      this.logger.log(
        `MCP connected (${this.tools.map((tool) => tool.name).join(', ')})`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to start MCP servers: ${message}`);
      try {
        await this.adapter?.close();
      } catch {
        // Best-effort cleanup after a failed connect.
      }
      this.adapter = undefined;
      this.tools = [];
      throw error;
    }
  }

  private assertExpectedTools(
    toolsets: Record<string, DynamicStructuredTool[]>,
  ): void {
    for (const [serverName, expected] of Object.entries(
      EXPECTED_TOOLS_BY_SERVER,
    )) {
      const discovered = toolsets[serverName] ?? [];
      const names = new Set(discovered.map((tool) => tool.name));
      for (const toolName of expected) {
        const prefixed = `${serverName}_${toolName}`;
        if (!names.has(toolName) && !names.has(prefixed)) {
          throw new Error(
            `MCP server "${serverName}" must expose ${toolName}; discovered: ${[...names].join(', ') || '(none)'}`,
          );
        }
      }
    }
  }

  getTools(): DynamicStructuredTool[] {
    return this.tools;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.adapter) return;
    await this.adapter.close();
    this.adapter = undefined;
    this.tools = [];
  }
}
