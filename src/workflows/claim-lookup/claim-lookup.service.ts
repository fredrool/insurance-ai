import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatBedrockConverse } from '@langchain/aws';

import { InsuranceMcpService } from '../../agents/bedrock/insurance-mcp.service.js';
import { BedrockEmbeddingsService } from '../../rag/embeddings/bedrock-embeddings.service.js';
import { DocumentRetrieverService } from '../../rag/retrieval/document-retriever.service.js';

import {
  buildClaimLookupGraph,
  type CompiledClaimLookupGraph,
} from './claim-lookup.graph.js';
import type {
  ClaimLookupRequest,
  ClaimLookupResponse,
} from './claim-lookup.types.js';

@Injectable()
export class ClaimLookupWorkflowService implements OnModuleInit {
  private graph?: CompiledClaimLookupGraph;
  private model?: ChatBedrockConverse;

  constructor(
    private readonly config: ConfigService,
    private readonly insuranceMcp: InsuranceMcpService,
    private readonly embeddings: BedrockEmbeddingsService,
    private readonly documentRetriever: DocumentRetrieverService,
  ) {}

  onModuleInit(): void {
    this.model = new ChatBedrockConverse({
      model: this.config.getOrThrow<string>('BEDROCK_MODEL_ID'),
      region: this.config.getOrThrow<string>('BEDROCK_AWS_REGION'),
      maxTokens: 1024,
    });

    this.graph = buildClaimLookupGraph({
      invokeMcpTool: (toolName, input) =>
        this.insuranceMcp.invokeTool(toolName, input),
      embeddings: this.embeddings,
      retriever: this.documentRetriever,
      model: this.model,
    });
  }

  async run(request: ClaimLookupRequest): Promise<ClaimLookupResponse> {
    if (!this.graph) {
      throw new Error('Claim lookup workflow not initialized');
    }

    const startedAt = Date.now();
    const result = await this.graph.invoke({
      claimId: request.claimId.trim(),
      question: request.question.trim(),
      claim: null,
      customer: null,
      sources: [],
      warnings: [],
      answer: '',
      mcpCalls: 0,
      llmCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
    });

    return {
      answer: result.answer,
      sources: result.sources,
      warnings: result.warnings,
      claim: result.claim,
      customer: result.customer,
      metrics: {
        durationMs: Date.now() - startedAt,
        llmCalls: result.llmCalls,
        mcpCalls: result.mcpCalls,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    };
  }
}