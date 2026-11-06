import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatAnthropic } from '@langchain/anthropic';
import { createAgent, tool } from 'langchain';
import { z } from 'zod';
import { OnModuleInit } from '@nestjs/common';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

import { InsuranceService } from '../../insurance/insurance.service.js';
import { INSURANCE_AGENT_PROMPT } from '../shared/insurance-agent.prompt.js';
import { createInsuranceTools } from '../shared/insurance-tools.factory.js';

@Injectable()
export class LangchainAgentService implements OnModuleInit {
  private agent: ReturnType<typeof createAgent> | undefined;

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(InsuranceService)
    private readonly insuranceService: InsuranceService,
  ) {
    
  }

  async onModuleInit(): Promise<void> {
    const checkpointer = PostgresSaver.fromConnString(
      this.config.getOrThrow<string>('DATABASE_URL'),
    );
  
    await checkpointer.setup();
  
    

    const model = new ChatAnthropic({
      anthropicApiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
      model: this.config.getOrThrow<string>('ANTHROPIC_MODEL'),
      maxTokens: 1024,
    });
  
    const tools = createInsuranceTools(this.insuranceService);

    this.agent = createAgent({
      model,
      tools,
      systemPrompt: INSURANCE_AGENT_PROMPT,
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
          thread_id: conversationId,
        },
      },
    );
  
    const lastMessage = result.messages.at(-1);
  
    if (!lastMessage) {
      return '';
    }
  
    if (typeof lastMessage.content === 'string') {
      return lastMessage.content;
    }

    if (!Array.isArray(lastMessage.content)) {
      return '';
    }

    const contentBlocks: unknown[] = lastMessage.content;

    return contentBlocks
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