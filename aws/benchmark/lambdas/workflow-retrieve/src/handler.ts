import type { Handler } from 'aws-lambda';

import { embedText } from '../../../shared/src/bedrock-titan.js';
import { DEFAULT_CORPUS_KEY } from '../../../shared/src/corpus.js';
import { loadCorpusFromS3 } from '../../../shared/src/corpus-s3.js';
import {
  buildRetrievalQuery,
  retrievePolicyClausesFromCorpus,
} from '../../../shared/src/workflow-retrieval.js';
import type { WorkflowState } from '../../../shared/src/workflow-state.js';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export const handler: Handler<WorkflowState, WorkflowState> = async (state) => {
  const bucket = requiredEnv('CORPUS_BUCKET');
  const key = process.env.CORPUS_OBJECT_KEY ?? DEFAULT_CORPUS_KEY;
  const region = process.env.AWS_REGION ?? requiredEnv('BEDROCK_AWS_REGION');
  const chunks = await loadCorpusFromS3(bucket, key, region);
  const query = buildRetrievalQuery(state.question, state.claim);
  const embedding = await embedText(query, region);
  const { sources, warnings } = retrievePolicyClausesFromCorpus(
    chunks,
    embedding,
  );
  return {
    ...state,
    sources,
    warnings: [...state.warnings, ...warnings],
    metrics: {
      ...state.metrics,
      embeddingCalls: state.metrics.embeddingCalls + 1,
    },
  };
};