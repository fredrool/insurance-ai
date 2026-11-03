import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatAnthropic } from '@langchain/anthropic';
import { createAgent, tool } from 'langchain';
import { z } from 'zod';

import { InsuranceService } from '../../insurance/insurance.service.js';
import { INSURANCE_AGENT_PROMPT } from '../insurance-agent.prompt.js';

@Injectable()
export class LangchainAgentService {
  private readonly agent;

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(InsuranceService)
    private readonly insuranceService: InsuranceService,
  ) {
    const getClaimStatus = tool(
      async ({ claimId }) => {
        const claim = this.insuranceService.getClaimStatus(claimId);
        return JSON.stringify(claim);
      },
      {
        name: 'getClaimStatus',
        description: 'Retrieve the status of an insurance claim.',
        schema: z.object({
          claimId: z.string().describe('Claim ID, e.g. CLM-001'),
        }),
      },
    );

    const getPolicyDetails = tool(
      async ({ policyId }) => {
        const policy = this.insuranceService.getPolicyDetails(policyId);
        return JSON.stringify(policy);
      },
      {
        name: 'getPolicyDetails',
        description: 'Retrieve details of an insurance policy.',
        schema: z.object({
          policyId: z.string().describe('Policy ID, e.g. POL-001'),
        }),
      },
    );

    const model = new ChatAnthropic({
      anthropicApiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
      model: this.config.getOrThrow<string>('ANTHROPIC_MODEL'),
      maxTokens: 1024,
    });

    this.agent = createAgent({
      model,
      tools: [getClaimStatus, getPolicyDetails],
      systemPrompt: INSURANCE_AGENT_PROMPT,
    });
  }

  async ask(question: string): Promise<string> {
    const result = await this.agent.invoke({
      messages: [{ role: 'user', content: question }],
    });

    const lastMessage = result.messages.at(-1);

    if (!lastMessage) {
        return '';
      }
    
      if (typeof lastMessage.content === 'string') {
        return lastMessage.content;
      }
    
      return lastMessage.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
  }
}