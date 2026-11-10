import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';

import { BedrockEmbeddingsService } from './bedrock-embeddings.service.js';

const mockSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn(function BedrockRuntimeClient() {
    return { send: mockSend };
  }),
  InvokeModelCommand: vi.fn(function InvokeModelCommand(input: unknown) {
    return input;
  }),
}));

describe('BedrockEmbeddingsService', () => {
  let service: BedrockEmbeddingsService;

  beforeEach(async () => {
    mockSend.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BedrockEmbeddingsService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'BEDROCK_AWS_REGION') return 'us-east-1';
              throw new Error(`Unknown key ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get(BedrockEmbeddingsService);
  });

  it('returns a 512-dimensional embedding from Bedrock Titan', async () => {
    const vector = Array.from({ length: 512 }, (_, i) => i / 512);
    mockSend.mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({ embedding: vector })),
    });

    const embedding = await service.embed('What is a deductible?');

    expect(embedding).toEqual(vector);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('rejects empty text', async () => {
    await expect(service.embed('   ')).rejects.toThrow('Cannot embed empty text');
    expect(mockSend).not.toHaveBeenCalled();
  });
});
