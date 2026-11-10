import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';

import { BedrockEmbeddingsService } from './embeddings/bedrock-embeddings.service.js';
import { DocumentRetrieverService } from './retrieval/document-retriever.service.js';
import { RagService } from './rag.service.js';

const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock('@langchain/aws', () => ({
  ChatBedrockConverse: vi.fn(function ChatBedrockConverse() {
    return { invoke: mockInvoke };
  }),
}));

describe('RagService', () => {
  let service: RagService;
  const embeddings = { embed: vi.fn() };
  const retriever = {
    searchGlobal: vi.fn(),
    searchByDocuments: vi.fn(),
  };

  beforeEach(async () => {
    mockInvoke.mockReset();
    embeddings.embed.mockReset();
    retriever.searchGlobal.mockReset();
    retriever.searchByDocuments.mockReset();

    embeddings.embed.mockResolvedValue([0.11, 0.22]);
    retriever.searchGlobal.mockResolvedValue([
      {
        documentName: 'claims-procedure.pdf',
        documentVersion: '1.3.0',
        pageNumber: 2,
        chunkIndex: 4,
        content: 'Report claims within 7 days.',
        similarity: 0.88,
      },
    ]);
    mockInvoke.mockResolvedValue({
      content: 'You must report within 7 days. [SRC-001]',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'BEDROCK_MODEL_ID') return 'anthropic.claude-3-5-sonnet-20241022-v2:0';
              if (key === 'BEDROCK_AWS_REGION') return 'us-east-1';
              throw new Error(`Unknown key ${key}`);
            },
          },
        },
        { provide: BedrockEmbeddingsService, useValue: embeddings },
        { provide: DocumentRetrieverService, useValue: retriever },
      ],
    }).compile();

    service = module.get(RagService);
  });

  it('returns answer and sources with stable IDs using global search by default', async () => {
    const result = await service.ask('How long do I have to report a claim?');

    expect(result.answer).toContain('7 days');
    expect(result.sources).toEqual([
      {
        id: 'SRC-001',
        documentName: 'claims-procedure.pdf',
        documentVersion: '1.3.0',
        pageNumber: 2,
        chunkIndex: 4,
        content: 'Report claims within 7 days.',
        similarity: 0.88,
      },
    ]);
    expect(embeddings.embed).toHaveBeenCalledTimes(1);
    expect(retriever.searchGlobal).toHaveBeenCalledTimes(1);
    expect(retriever.searchByDocuments).not.toHaveBeenCalled();

    const userMessage = mockInvoke.mock.calls[0][0][1].content as string;
    expect(userMessage).toContain('[SRC-001]');
    expect(userMessage).toContain('Report claims within 7 days.');
  });

  it('uses per-document retrieval when documentNames are provided', async () => {
    retriever.searchByDocuments.mockResolvedValue([]);

    await service.ask('Water damage question', [
      'home-insurance.pdf',
      'claims-procedure.pdf',
    ]);

    expect(retriever.searchByDocuments).toHaveBeenCalledWith(
      [0.11, 0.22],
      ['home-insurance.pdf', 'claims-procedure.pdf'],
    );
    expect(retriever.searchGlobal).not.toHaveBeenCalled();
  });
});
