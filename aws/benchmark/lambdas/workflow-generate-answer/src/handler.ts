import type { Handler } from 'aws-lambda';

import { generateWorkflowAnswer } from '../../../shared/src/bedrock-answer.js';
import type { WorkflowState } from '../../../shared/src/workflow-state.js';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

const DEFAULT_MODEL =
  'us.anthropic.claude-haiku-4-5-20251001-v1:0';

export const handler: Handler<WorkflowState, WorkflowState> = async (state) => {
  const region = requiredEnv('BEDROCK_AWS_REGION');
  const modelId = process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL;
  const { answer, inputTokens, outputTokens } = await generateWorkflowAnswer(
    {
      question: state.question,
      claim: state.claim,
      customer: state.customer,
      sources: state.sources,
      warnings: state.warnings,
    },
    modelId,
    region,
  );
  return {
    ...state,
    answer,
    metrics: {
      ...state.metrics,
      llmCalls: state.metrics.llmCalls + 1,
      inputTokens: state.metrics.inputTokens + inputTokens,
      outputTokens: state.metrics.outputTokens + outputTokens,
    },
  };
};