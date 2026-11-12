import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';

import { BedrockEmbeddingsService } from '../../rag/embeddings/bedrock-embeddings.service.js';
import { DocumentRetrieverService } from '../../rag/retrieval/document-retriever.service.js';
import { BedrockAgentService } from './bedrock-agent.service.js';
import { InsuranceMcpService } from './insurance-mcp.service.js';
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
          provide: InsuranceMcpService,
          useValue: {
            getTools: () => [
              { name: 'claims_getClaimStatus' },
              { name: 'claims_getPolicyDetails' },
              { name: 'crm_getCustomerDetails' },
              { name: 'crm_getCustomerByPolicy' },
            ],
          },
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

  it('registers MCP and RAG tools at init', () => {
    expect(agentConfig.tools.map((tool) => tool.name)).toEqual([
      'claims_getClaimStatus',
      'claims_getPolicyDetails',
      'crm_getCustomerDetails',
      'crm_getCustomerByPolicy',
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

  it('returns debug payload with Claims and CRM MCP tool calls', async () => {
    mockInvoke.mockResolvedValue({
      messages: [
        {
          type: 'ai',
          tool_calls: [
            {
              name: 'claims_getClaimStatus',
              args: { claimId: 'CLM-001' },
            },
          ],
        },
        {
          type: 'tool',
          name: 'claims_getClaimStatus',
          content: JSON.stringify({
            id: 'CLM-001',
            policyId: 'POL-001',
            status: 'under_review',
          }),
        },
        {
          type: 'ai',
          tool_calls: [
            {
              name: 'crm_getCustomerByPolicy',
              args: { policyId: 'POL-001' },
            },
          ],
        },
        {
          type: 'tool',
          name: 'crm_getCustomerByPolicy',
          content: JSON.stringify({
            id: 'CUS-1001',
            displayName: 'Alex Martin',
            policyIds: ['POL-001'],
          }),
        },
        { content: 'Claim CLM-001 belongs to Alex Martin (POL-001).' },
      ],
    });

    const result = await service.ask(
      'Who owns the policy for claim CLM-001?',
      'conv-mcp',
      true,
    );

    expect(result).toMatchObject({
      answer: 'Claim CLM-001 belongs to Alex Martin (POL-001).',
      toolCalls: [
        { name: 'claims_getClaimStatus', args: { claimId: 'CLM-001' } },
        { name: 'crm_getCustomerByPolicy', args: { policyId: 'POL-001' } },
      ],
    });
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
