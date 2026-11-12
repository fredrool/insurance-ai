import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { MCPAdapter } from '@langchain/mcp-adapters';
import type { DynamicStructuredTool } from '@langchain/core/tools';

import { resolveClaimsMcpServerLaunch } from './claims-mcp.launch.js';

const CLAIMS_SERVER_NAME = 'claims';
const EXPECTED_CLAIMS_TOOLS = ['getClaimStatus', 'getPolicyDetails'] as const;

@Injectable()
export class ClaimsMcpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClaimsMcpService.name);
  private adapter?: MCPAdapter;
  private tools: DynamicStructuredTool[] = [];

  async onModuleInit(): Promise<void> {
    const launch = resolveClaimsMcpServerLaunch();

    try {
      this.adapter = new MCPAdapter({
        prefixToolNameWithServerName: false,
        servers: {
          [CLAIMS_SERVER_NAME]: {
            transport: 'stdio',
            command: launch.command,
            args: launch.args,
            cwd: launch.cwd,
          },
        },
      });

      const discovered = await this.adapter.listTools(CLAIMS_SERVER_NAME);
      this.tools = discovered.filter((tool) =>
        (EXPECTED_CLAIMS_TOOLS as readonly string[]).includes(tool.name),
      );

      if (this.tools.length !== EXPECTED_CLAIMS_TOOLS.length) {
        const names = discovered.map((tool) => tool.name).join(', ') || '(none)';
        throw new Error(
          `MCP Claims server must expose ${EXPECTED_CLAIMS_TOOLS.join(' and ')}; discovered: ${names}`,
        );
      }

      this.logger.log(
        `MCP Claims connected (${this.tools.map((tool) => tool.name).join(', ')})`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to start MCP Claims server (command=${launch.command}, args=${launch.args.join(' ')}): ${message}`,
      );
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
