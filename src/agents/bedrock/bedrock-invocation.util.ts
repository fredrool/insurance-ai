import { sanitizeLoggedArgs } from '../shared/sanitize-tool-args.util.js';
import type {
  BedrockRetrievalSource,
  BedrockToolCallSummary,
} from './bedrock-agent.types.js';
import type { AgentExecutionMetrics } from './agent-execution-metrics.js';

type UnknownMessage = Record<string, unknown>;

export function sliceTurnMessages(
  allMessages: unknown[],
  priorMessageCount: number,
): unknown[] {
  if (!Array.isArray(allMessages)) {
    return [];
  }

  return allMessages.slice(Math.max(0, priorMessageCount));
}

export function extractTurnObservability(turnMessages: unknown[]): {
  toolCalls: BedrockToolCallSummary[];
  sources: BedrockRetrievalSource[];
} {
  const toolCalls: BedrockToolCallSummary[] = [];
  const sources: BedrockRetrievalSource[] = [];
  const seenSourceKeys = new Set<string>();

  for (const message of turnMessages) {
    collectToolCalls(message, toolCalls);

    if (isToolResultMessage(message, 'searchInsuranceDocuments')) {
      for (const source of parseSearchToolSources(message)) {
        const dedupeKey = `${source.id}:${source.documentName}:${source.chunkIndex}`;
        if (seenSourceKeys.has(dedupeKey)) continue;
        seenSourceKeys.add(dedupeKey);
        sources.push(source);
      }
    }
  }

  return { toolCalls, sources };
}

export type TurnMetrics = Omit<AgentExecutionMetrics, 'durationMs'>;

export function extractTurnMetrics(turnMessages: unknown[]): TurnMetrics {
  let llmCalls = 0;
  let mcpCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const message of turnMessages) {
    if (!isRecord(message)) continue;

    const type = getMessageType(message);
    if (isModelMessage(type, message)) {
      llmCalls += 1;
      const usage = readTokenUsageFromMessage(message);
      inputTokens += usage.inputTokens;
      outputTokens += usage.outputTokens;
    }

    if (
      type === 'tool' &&
      typeof message.name === 'string' &&
      isMcpToolName(message.name)
    ) {
      mcpCalls += 1;
    }
  }

  return { llmCalls, mcpCalls, inputTokens, outputTokens };
}

function isMcpToolName(toolName: string): boolean {
  return toolName.startsWith('claims_') || toolName.startsWith('crm_');
}

function isModelMessage(
  type: string | undefined,
  message: Record<string, unknown>,
): boolean {
  if (type === 'ai' || type === 'assistant') {
    return true;
  }
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    return true;
  }
  return false;
}

function readTokenUsageFromMessage(message: Record<string, unknown>): {
  inputTokens: number;
  outputTokens: number;
} {
  const usageMetadata = message.usage_metadata;
  if (isRecord(usageMetadata)) {
    return {
      inputTokens: readNonNegativeInt(usageMetadata.input_tokens),
      outputTokens: readNonNegativeInt(usageMetadata.output_tokens),
    };
  }

  const responseMetadata = message.response_metadata;
  if (isRecord(responseMetadata) && isRecord(responseMetadata.usage)) {
    const usage = responseMetadata.usage;
    return {
      inputTokens: readNonNegativeInt(usage.input_tokens),
      outputTokens: readNonNegativeInt(usage.output_tokens),
    };
  }

  return { inputTokens: 0, outputTokens: 0 };
}

function readNonNegativeInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function collectToolCalls(
  message: unknown,
  toolCalls: BedrockToolCallSummary[],
): void {
  if (!isRecord(message)) return;

  const toolCallBlocks = message.tool_calls;
  if (!Array.isArray(toolCallBlocks)) return;

  for (const block of toolCallBlocks) {
    if (!isRecord(block)) continue;
    const name = typeof block.name === 'string' ? block.name : undefined;
    if (!name) continue;
    const args = isRecord(block.args) ? block.args : {};

    toolCalls.push({
      name,
      args: sanitizeLoggedArgs(name, args),
    });
  }
}

function isToolResultMessage(message: unknown, toolName: string): boolean {
  if (!isRecord(message)) return false;

  const type = getMessageType(message);
  if (type !== 'tool') return false;

  return message.name === toolName;
}

function parseSearchToolSources(message: unknown): BedrockRetrievalSource[] {
  if (!isRecord(message)) return [];

  const content = stringifyMessageContent(message.content);
  if (!content) return [];

  try {
    const parsed = JSON.parse(content) as { sources?: unknown[] };
    if (!Array.isArray(parsed.sources)) return [];

    return parsed.sources
      .filter(isRetrievalSource)
      .map((source) => ({
        id: source.id,
        documentName: source.documentName,
        documentVersion: source.documentVersion,
        pageNumber: source.pageNumber,
        chunkIndex: source.chunkIndex,
        similarity: source.similarity,
      }));
  } catch {
    return [];
  }
}

function isRetrievalSource(value: unknown): value is BedrockRetrievalSource {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.documentName === 'string' &&
    typeof value.documentVersion === 'string' &&
    typeof value.pageNumber === 'number' &&
    typeof value.chunkIndex === 'number' &&
    typeof value.similarity === 'number'
  );
}

function getMessageType(message: UnknownMessage): string | undefined {
  if (typeof message.getType === 'function') {
    return String(message.getType());
  }
  if (typeof message.type === 'string') return message.type;
  if (typeof message.role === 'string') return message.role;
  return undefined;
}

function stringifyMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(isRecord)
      .map((block) => (typeof block.text === 'string' ? block.text : ''))
      .join('');
  }
  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
