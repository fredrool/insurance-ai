import { Logger } from '@nestjs/common';

import { sanitizeLoggedArgs } from './sanitize-tool-args.util.js';

const logger = new Logger('InsuranceTools');

export async function runToolWithLogging<T extends string>(
  toolName: T,
  args: Record<string, unknown>,
  execute: () => Promise<string>,
): Promise<string> {
  const startedAt = Date.now();
  const sanitizedArgs = sanitizeLoggedArgs(toolName, args);

  try {
    const result = await execute();
    const durationMs = Date.now() - startedAt;
    const logPayload: Record<string, unknown> = {
      event: 'tool_execution',
      tool: toolName,
      args: sanitizedArgs,
      durationMs,
      status: 'ok',
    };

    if (toolName === 'searchInsuranceDocuments') {
      try {
        const parsed = JSON.parse(result) as { sources?: unknown[] };
        logPayload.resultCount = Array.isArray(parsed.sources)
          ? parsed.sources.length
          : 0;
      } catch {
        logPayload.resultCount = 0;
      }
    }

    logger.log(JSON.stringify(logPayload));
    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error(
      JSON.stringify({
        event: 'tool_execution',
        tool: toolName,
        args: sanitizedArgs,
        durationMs,
        status: 'error',
        message: error instanceof Error ? error.message : 'Tool execution failed',
      }),
    );
    throw error;
  }
}
