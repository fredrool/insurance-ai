import { sanitizeLoggedArgs } from '../shared/sanitize-tool-args.util.js';
import type {
  BedrockRetrievalSource,
  BedrockToolCallSummary,
} from './bedrock-agent.types.js';

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
