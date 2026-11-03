import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INSURANCE_AGENT_PROMPT } from './insurance-agent.prompt.js';
import Anthropic from '@anthropic-ai/sdk';
import { insuranceTools } from './tools/insurance-tools.js';
import { InsuranceService } from '../../insurance/insurance.service.js';

@Injectable()
export class NativeAgentService {
  private readonly client: Anthropic;

  constructor(
    private readonly config: ConfigService,
    private readonly insuranceService: InsuranceService,
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
          const result = this.executeTool(tool.name, tool.input);

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

  private executeTool(name: string, input: unknown): unknown {
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

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}
