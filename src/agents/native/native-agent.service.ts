import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INSURANCE_AGENT_PROMPT } from '../shared/insurance-agent.prompt.js';
import Anthropic from '@anthropic-ai/sdk';
import { insuranceTools } from './tools/insurance-tools.js';
import { InsuranceService } from '../../insurance/insurance.service.js';
import { BedrockEmbeddingsService } from '../../rag/embeddings/bedrock-embeddings.service.js';
import { DocumentRetrieverService } from '../../rag/retrieval/document-retriever.service.js';
import type { DocumentChunkRow } from '../../rag/rag.types.js';

const DEFAULT_GLOBAL_TOP_K = 5;
const DEFAULT_PER_DOCUMENT_TOP_K = 3;

@Injectable()
export class NativeAgentService {
  private readonly client: Anthropic;

  constructor(
    private readonly config: ConfigService,
    private readonly insuranceService: InsuranceService,
    private readonly embeddings: BedrockEmbeddingsService,
    private readonly documentRetriever: DocumentRetrieverService,
  ) {
    this.client = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
  }

  async ask(question: string): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: question,
      },
    ];

    for (let iteration = 0; iteration < 5; iteration++) {
      const response = await this.client.messages.create({
        model: this.config.getOrThrow<string>('ANTHROPIC_MODEL'),
        max_tokens: 1024,
        system: INSURANCE_AGENT_PROMPT,
        tools: insuranceTools,
        messages,
      });

      console.log('Claude stop reason:', response.stop_reason);

      if (response.stop_reason === 'end_turn') {
        return response.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n');
      }

      if (response.stop_reason !== 'tool_use') {
        throw new Error(
          `Unexpected stop reason: ${response.stop_reason}`,
        );
      }

      const toolCalls = response.content.filter(
        (block): block is Anthropic.ToolUseBlock =>
          block.type === 'tool_use',
      );

      messages.push({
        role: 'assistant',
        content: response.content,
      });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const tool of toolCalls) {
        console.log(`Executing: ${tool.name}`, tool.input);

        try {
          const result = await this.executeTool(tool.name, tool.input);

          console.log('Tool result:', result);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          console.error('TOOL EXECUTION ERROR:', error);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            is_error: true,
            content:
              error instanceof Error
                ? error.message
                : 'Tool execution failed',
          });
        }
      }

      messages.push({
        role: 'user',
        content: toolResults,
      });
    }

    throw new Error('Maximum agent iterations reached');
  }

  private async executeTool(name: string, input: unknown): Promise<unknown> {
    if (typeof input !== 'object' || input === null) {
      throw new Error('Invalid tool input');
    }

    const args = input as Record<string, unknown>;

    switch (name) {
      case 'getClaimStatus':
        if (typeof args.claimId !== 'string') {
          throw new Error('Invalid claimId');
        }

        return this.insuranceService.getClaimStatus(args.claimId);

      case 'getPolicyDetails':
        if (typeof args.policyId !== 'string') {
          throw new Error('Invalid policyId');
        }

        return this.insuranceService.getPolicyDetails(args.policyId);

      case 'searchInsuranceDocuments':
        return this.searchInsuranceDocuments(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async searchInsuranceDocuments(args: Record<string, unknown>) {
    if (typeof args.query !== 'string' || !args.query.trim()) {
      throw new Error('Invalid query');
    }

    const query = args.query.trim();
    const documentNames = Array.isArray(args.documentNames)
      ? args.documentNames.filter((name): name is string => typeof name === 'string')
      : undefined;

    let topK = DEFAULT_GLOBAL_TOP_K;
    if (typeof args.topK === 'number' && Number.isFinite(args.topK)) {
      topK = Math.min(20, Math.max(1, Math.floor(args.topK)));
    }

    const embedding = await this.embeddings.embed(query);
    const chunks: DocumentChunkRow[] =
      documentNames && documentNames.length > 0
        ? await this.documentRetriever.searchByDocuments(
            embedding,
            documentNames,
            topK || DEFAULT_PER_DOCUMENT_TOP_K,
          )
        : await this.documentRetriever.searchGlobal(embedding, topK);

    return {
      query,
      sources: assignSourceIds(chunks),
    };
  }
}

function assignSourceIds(chunks: DocumentChunkRow[]) {
  return chunks.map((chunk, index) => ({
    id: `SRC-${String(index + 1).padStart(3, '0')}`,
    documentName: chunk.documentName,
    documentVersion: chunk.documentVersion,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    similarity: chunk.similarity,
    content: chunk.content,
  }));
}