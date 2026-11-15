import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

export const TITAN_EMBED_MODEL_ID = 'amazon.titan-embed-text-v2:0';
export const EMBEDDING_DIMENSIONS = 512;

export async function embedText(
  text: string,
  region: string,
): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Cannot embed empty text');
  }
  const client = new BedrockRuntimeClient({ region });
  const response = await client.send(
    new InvokeModelCommand({
      modelId: TITAN_EMBED_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inputText: trimmed,
        dimensions: EMBEDDING_DIMENSIONS,
        normalize: true,
      }),
    }),
  );
  if (!response.body) {
    throw new Error('Bedrock embedding response had no body');
  }
  const result = JSON.parse(new TextDecoder().decode(response.body)) as {
    embedding?: number[];
  };
  if (!result.embedding?.length) {
    throw new Error('Bedrock embedding response missing embedding vector');
  }
  return result.embedding;
}