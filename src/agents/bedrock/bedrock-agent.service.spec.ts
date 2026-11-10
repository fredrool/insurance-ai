import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';

import { BedrockEmbeddingsService } from '../../rag/embeddings/bedrock-embeddings.service.js';
import { DocumentRetrieverService } from '../../rag/retrieval/document-retriever.service.js';
import { InsuranceService } from '../../insurance/insurance.service.js';
import { BedrockAgentService } from './bedrock-agent.service.js';
import { BEDROCK_INSURANCE_AGENT_PROMPT } from './bedrock-agent.prompt.js';

const mockInvoke = vi.hoisted(() => vi.fn());
const mockGetState = vi.hoisted(() => vi.fn());
const createAgentMock = vi.hoisted(() =>
  vi.fn(function createAgent(_config?: unknown) {
    return { invoke: mockInvoke, getState: mockGetState };
  }),
);

const agentConfig = vi.hoisted(() => ({ tools: [] as { name: string }[], systemPrompt: '' }));

vi.mock('langchain', async (importOriginal) => {
  const original = await importOriginal<typeof import('langchain')>();
  return {
    ...original,
    createAgent: vi.fn(function createAgent(config: {
      tools: { name: string }[];
      systemPrompt: string;
    }) {
      agentConfig.tools = config.tools;
      agentConfig.systemPrompt = config.systemPrompt;
      return createAgentMock(config);
    }),
  };
});

vi.mock('@langchain/langgraph-checkpoint-postgres', () => ({
  PostgresSaver: {
    fromConnString: vi.fn(function fromConnString() {
      return { setup: vi.fn().mockResolvedValue(undefined) };
    }),
  },
}));

vi.mock('@langchain/aws', () => ({
  ChatBedrockConverse: vi.fn(function ChatBedrockConverse() {
    return {};
  }),
}));

describe('BedrockAgentService', () => {
  let service: BedrockAgentService;

  beforeEach(async () => {
    mockInvoke.mockReset();
    mockGetState.mockReset();
    mockGetState.mockResolvedValue({ values: { messages: [] } });
    createAgentMock.mockClear();
    agentConfig.tools = [];
    agentConfig.systemPrompt = '';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BedrockAgentService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'DATABASE_URL') {
                return 'postgresql://insurance:insurance@localhost:5432/insurance_ai';
              }
              if (key === 'BEDROCK_MODEL_ID') {
                return 'anthropic.claude-3-5-sonnet-20241022-v2:0';
              }
              if (key === 'BEDROCK_AWS_REGION') return 'us-east-1';
              throw new Error(`Unknown key ${key}`);
            },
          },
        },
        {
          provide: InsuranceService,
          useValue: { getClaimStatus: vi.fn(), getPolicyDetails: vi.fn() },
        },
        {
          provide: BedrockEmbeddingsService,
          useValue: { embed: vi.fn() },
        },
        {
          provide: DocumentRetrieverService,
          useValue: {
            searchGlobal: vi.fn(),
            searchByDocuments: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(BedrockAgentService);
    await service.onModuleInit();
  });

  it('registers searchInsuranceDocuments with structured data tools at init', () => {
    expect(agentConfig.tools.map((tool) => tool.name)).toEqual([
      'getClaimStatus',
      'getPolicyDetails',
      'searchInsuranceDocuments',
    ]);
    expect(agentConfig.systemPrompt).toBe(BEDROCK_INSURANCE_AGENT_PROMPT);
  });

  it('keeps PostgresSaver conversation threading on ask', async () => {
    mockInvoke.mockResolvedValue({
      messages: [{ content: 'Answer with citation' }],
    });

    const answer = await service.ask('Is flood covered?', 'conv-123');

    expect(answer).toBe('Answer with citation');
    expect(mockGetState).toHaveBeenCalledWith({
      configurable: { thread_id: 'bedrock:conv-123' },
    });
    expect(mockInvoke).toHaveBeenCalledWith(
      { messages: [{ role: 'user', content: 'Is flood covered?' }] },
      { configurable: { thread_id: 'bedrock:conv-123' } },
    );
  });

  it('returns debug payload from current turn tool messages', async () => {
    mockGetState.mockResolvedValue({
      values: { messages: [{ content: 'historical answer' }] },
    });
    mockInvoke.mockResolvedValue({
      messages: [
        { content: 'historical answer' },
        {
          type: 'ai',
          tool_calls: [
            {
              name: 'searchInsuranceDocuments',
              args: { query: 'deductible' },
            },
          ],
        },
        {
          type: 'tool',
          name: 'searchInsuranceDocuments',
          content: JSON.stringify({
            query: 'deductible',
            sources: [
              {
                id: 'SRC-001',
                documentName: 'auto-insurance.pdf',
                documentVersion: '2.1.0',
                pageNumber: 8,
                chunkIndex: 3,
                similarity: 0.9,
                content: 'Collision deductible applies per occurrence.',
              },
            ],
          }),
        },
        { content: 'The deductible is $1,000 per occurrence.' },
      ],
    });

    const result = await service.ask('What is my deductible?', 'conv-123', true);

    expect(result).toEqual({
      answer: 'The deductible is $1,000 per occurrence.',
      toolCalls: [
        {
          name: 'searchInsuranceDocuments',
          args: { query: 'deductible' },
        },
      ],
      sources: [
        {
          id: 'SRC-001',
          documentName: 'auto-insurance.pdf',
          documentVersion: '2.1.0',
          pageNumber: 8,
          chunkIndex: 3,
          similarity: 0.9,
        },
      ],
    });
  });
});
