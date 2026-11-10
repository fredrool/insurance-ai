import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatBedrockConverse } from '@langchain/aws';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { createAgent } from 'langchain';

import { BedrockEmbeddingsService } from '../../rag/embeddings/bedrock-embeddings.service.js';
import { DocumentRetrieverService } from '../../rag/retrieval/document-retriever.service.js';
import { InsuranceService } from '../../insurance/insurance.service.js';
import { createInsuranceTools } from '../shared/insurance-tools.factory.js';
import { BEDROCK_INSURANCE_AGENT_PROMPT } from './bedrock-agent.prompt.js';
import type { BedrockAskResult } from './bedrock-agent.types.js';
import {
  extractTurnObservability,
  sliceTurnMessages,
} from './bedrock-invocation.util.js';

type StatefulBedrockAgent = ReturnType<typeof createAgent> & {
  getState: (config: {
    configurable: { thread_id: string };
  }) => Promise<{ values?: { messages?: unknown[] } }>;
};

@Injectable()
export class BedrockAgentService implements OnModuleInit {
  private agent?: StatefulBedrockAgent;

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(InsuranceService)
    private readonly insuranceService: InsuranceService,
    private readonly embeddings: BedrockEmbeddingsService,
    private readonly documentRetriever: DocumentRetrieverService,
  ) {}

  async onModuleInit(): Promise<void> {
    const checkpointer = PostgresSaver.fromConnString(
      this.config.getOrThrow<string>('DATABASE_URL'),
    );

    await checkpointer.setup();

    const model = new ChatBedrockConverse({
      model: this.config.getOrThrow<string>('BEDROCK_MODEL_ID'),
      region: this.config.getOrThrow<string>('BEDROCK_AWS_REGION'),
      maxTokens: 1024,
    });

    this.agent = createAgent({
      model,
      tools: createInsuranceTools(this.insuranceService, {
        embeddings: this.embeddings,
        retriever: this.documentRetriever,
      }),
      systemPrompt: BEDROCK_INSURANCE_AGENT_PROMPT,
      checkpointer,
    }) as StatefulBedrockAgent;
  }

  async ask(
    question: string,
    conversationId: string,
    debug = false,
  ): Promise<string | BedrockAskResult> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    const invokeConfig = {
      configurable: {
        thread_id: `bedrock:${conversationId}`,
      },
    };

    const priorState = await this.agent.getState(invokeConfig);
    const priorMessageCount = priorState.values?.messages?.length ?? 0;

    const result = await this.agent.invoke(
      {
        messages: [{ role: 'user', content: question }],
      },
      invokeConfig,
    );

    const answer = this.extractAnswer(result.messages);
    const turnMessages = sliceTurnMessages(result.messages, priorMessageCount);
    const { toolCalls, sources } = extractTurnObservability(turnMessages);

    if (!debug) {
      return answer;
    }

    return { answer, toolCalls, sources };
  }

  private extractAnswer(messages: unknown[] | undefined): string {
    const lastMessage = Array.isArray(messages) ? messages.at(-1) : undefined;
    if (!lastMessage) return '';

    if (
      typeof lastMessage === 'object' &&
      lastMessage !== null &&
      'content' in lastMessage
    ) {
      const { content } = lastMessage as { content: unknown };
      if (typeof content === 'string') {
        return content;
      }

      if (Array.isArray(content)) {
        return content
          .filter(
            (block): block is { type: 'text'; text: string } =>
              typeof block === 'object' &&
              block !== null &&
              'type' in block &&
              block.type === 'text' &&
              'text' in block &&
              typeof block.text === 'string',
          )
          .map((block) => block.text)
          .join('\n');
      }
    }

    return '';
  }
}
