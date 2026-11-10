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

@Injectable()
export class BedrockAgentService implements OnModuleInit {
  private agent?: ReturnType<typeof createAgent>;

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
    });
  }

  async ask(
    question: string,
    conversationId: string,
  ): Promise<string> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    const result = await this.agent.invoke(
      {
        messages: [{ role: 'user', content: question }],
      },
      {
        configurable: {
          thread_id: `bedrock:${conversationId}`,
        },
      },
    );

    const lastMessage = result.messages.at(-1);

    if (!lastMessage) return '';

    if (typeof lastMessage.content === 'string') {
      return lastMessage.content;
    }

    const contentBlocks: unknown[] = lastMessage.content;

    return contentBlocks
      .filter((block): block is { type: 'text'; text: string } => typeof block === 'object' && block !== null && 'type' in block && block.type === 'text' && 'text' in block && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n');
  }
}