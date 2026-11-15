import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

import { WORKFLOW_ANSWER_PROMPT } from './workflow-prompt.js';
import type { InsuranceClaim } from './claims.js';
import type { CrmCustomer } from './crm.js';
import type { RagSourceSnapshot } from './workflow-state.js';

export interface GenerateAnswerInput {
  question: string;
  claim: InsuranceClaim | null;
  customer: CrmCustomer | null;
  sources: RagSourceSnapshot[];
  warnings: string[];
}

export interface GenerateAnswerResult {
  answer: string;
  inputTokens: number;
  outputTokens: number;
}

export async function generateWorkflowAnswer(
  input: GenerateAnswerInput,
  modelId: string,
  region: string,
): Promise<GenerateAnswerResult> {
  const context =
    input.sources.length === 0
      ? 'No policy excerpts were retrieved.'
      : input.sources
          .map(
            (source) =>
              `[${source.id}] ${source.documentName} v${source.documentVersion} p.${source.pageNumber}\n${source.content}`,
          )
          .join('\n\n---\n\n');

  const structured = JSON.stringify(
    {
      claim: input.claim,
      customer: input.customer,
      workflowWarnings: input.warnings,
    },
    null,
    2,
  );

  const userContent = `Question:\n${input.question}\n\nStructured data:\n${structured}\n\nPolicy excerpts:\n${context}`;

  const client = new BedrockRuntimeClient({ region });
  const response = await client.send(
    new ConverseCommand({
      modelId,
      system: [{ text: WORKFLOW_ANSWER_PROMPT }],
      messages: [{ role: 'user', content: [{ text: userContent }] }],
      inferenceConfig: { maxTokens: 1024 },
    }),
  );

  const answer =
    response.output?.message?.content
      ?.map((block) => ('text' in block ? block.text : ''))
      .join('\n')
      .trim() ?? '';

  return {
    answer,
    inputTokens: response.usage?.inputTokens ?? 0,
    outputTokens: response.usage?.outputTokens ?? 0,
  };
}