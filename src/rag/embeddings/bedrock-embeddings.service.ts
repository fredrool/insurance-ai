import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TITAN_EMBED_MODEL_ID = 'amazon.titan-embed-text-v2:0';
const EMBEDDING_DIMENSIONS = 512;

@Injectable()
export class BedrockEmbeddingsService {
  private readonly client: BedrockRuntimeClient;

  constructor(private readonly config: ConfigService) {
    this.client = new BedrockRuntimeClient({
      region: this.config.getOrThrow<string>('BEDROCK_AWS_REGION'),
    });
  }

  async embed(text: string): Promise<number[]> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Cannot embed empty text');
    }

    const response = await this.client.send(
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

    const result = JSON.parse(
      new TextDecoder().decode(response.body),
    ) as { embedding?: number[] };

    if (!result.embedding?.length) {
      throw new Error('Bedrock embedding response missing embedding vector');
    }

    return result.embedding;
  }
}
