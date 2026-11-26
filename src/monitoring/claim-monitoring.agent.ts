import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatBedrockConverse } from '@langchain/aws';
import { createAgent } from 'langchain';
import { randomUUID } from 'node:crypto';

import { CLAIM_MONITORING_SYSTEM_PROMPT } from './claim-monitoring.prompt.js';
import {
  claimAssessmentSchema,
  type ClaimAssessment,
  type MonitoringClaimInput,
} from './claim-monitoring.types.js';

type MonitoringAgent = ReturnType<typeof createAgent>;

@Injectable()
export class ClaimMonitoringAgent implements OnModuleInit {
  private agent?: MonitoringAgent;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const model = new ChatBedrockConverse({
      model: this.config.getOrThrow<string>('BEDROCK_MODEL_ID'),
      region: this.config.getOrThrow<string>('BEDROCK_AWS_REGION'),
      maxTokens: 1024,
    });

    this.agent = createAgent({
      model,
      tools: [],
      systemPrompt: CLAIM_MONITORING_SYSTEM_PROMPT,
      responseFormat: claimAssessmentSchema,
    });
  }

  /**
   * Each claim is evaluated in isolation (fresh thread_id, no checkpointer).
   */
  async onClaim(claim: MonitoringClaimInput): Promise<ClaimAssessment> {
    if (!this.agent) {
      throw new Error('Claim monitoring agent not initialized');
    }

    const payload = {
      ...claim,
      policyId: claim.policyId ?? null,
    };

    const result = await this.agent.invoke(
      {
        messages: [
          {
            role: 'user',
            content: `Evaluate this single claim submission:\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
      },
      {
        configurable: {
          thread_id: `monitoring:${randomUUID()}`,
        },
      },
    );

    return this.extractAssessment(result, claim.claimId);
  }

  /** Exposed for tests to assert singleton initialization. */
  getInitializedAgent(): MonitoringAgent | undefined {
    return this.agent;
  }

  private extractAssessment(
    result: Record<string, unknown>,
    expectedClaimId: string,
  ): ClaimAssessment {
    const structured = result.structuredResponse;
    if (structured) {
      const parsed = claimAssessmentSchema.safeParse(structured);
      if (parsed.success) {
        return parsed.data;
      }
    }

    const messages = result.messages;
    if (Array.isArray(messages) && messages.length > 0) {
      const last = messages.at(-1) as { content?: unknown } | undefined;
      const text = this.readMessageText(last?.content);
      if (text) {
        const json = this.tryParseJson(text);
        if (json) {
          const parsed = claimAssessmentSchema.safeParse(json);
          if (parsed.success) {
            return parsed.data;
          }
        }
      }
    }

    throw new Error(
      `Could not parse claim assessment for ${expectedClaimId}`,
    );
  }

  private readMessageText(content: unknown): string {
    if (typeof content === 'string') {
      return content.trim();
    }
    if (!Array.isArray(content)) {
      return '';
    }
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
      .join('\n')
      .trim();
  }

  private tryParseJson(text: string): unknown {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
    const candidate = fenced?.[1]?.trim() ?? trimmed;
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      return null;
    }
  }
}