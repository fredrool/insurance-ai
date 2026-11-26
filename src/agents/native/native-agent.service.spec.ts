import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import { InsuranceService } from '../../insurance/insurance.service.js';
import { BedrockEmbeddingsService } from '../../rag/embeddings/bedrock-embeddings.service.js';
import { DocumentRetrieverService } from '../../rag/retrieval/document-retriever.service.js';
import { NativeAgentService } from './native-agent.service.js';

const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function MockAnthropic() {
    return {
      messages: {
        create: mockMessagesCreate,
      },
    };
  }),
}));

describe('NativeAgentService', () => {
  let service: NativeAgentService;
  const insuranceService = {
    getClaimStatus: vi.fn(),
    getPolicyDetails: vi.fn(),
  };
  const embeddings = { embed: vi.fn() };
  const documentRetriever = {
    searchGlobal: vi.fn(),
    searchByDocuments: vi.fn(),
  };

  beforeEach(async () => {
    mockMessagesCreate.mockReset();
    insuranceService.getClaimStatus.mockReset();
    insuranceService.getPolicyDetails.mockReset();
    embeddings.embed.mockReset();
    documentRetriever.searchGlobal.mockReset();
    documentRetriever.searchByDocuments.mockReset();

    mockMessagesCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Réponse mockée du modèle.' }],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NativeAgentService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'ANTHROPIC_API_KEY') return 'test-api-key';
              if (key === 'ANTHROPIC_MODEL') return 'claude-test-model';
              throw new Error(`Unknown config key: ${key}`);
            },
          },
        },
        { provide: InsuranceService, useValue: insuranceService },
        { provide: BedrockEmbeddingsService, useValue: embeddings },
        { provide: DocumentRetrieverService, useValue: documentRetriever },
      ],
    }).compile();

    service = module.get(NativeAgentService);
  });

  it('should execute a tool and return Claude final response', async () => {
    insuranceService.getClaimStatus.mockReturnValue({
      id: 'CLM-001',
      policyId: 'POL-001',
      status: 'under_review',
      description: 'Water damage in basement',
      submittedAt: '2026-10-15',
    });

    mockMessagesCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_test_001',
          name: 'getClaimStatus',
          input: { claimId: 'CLM-001' },
        },
      ],
    });

    mockMessagesCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: 'Votre réclamation est en cours d’examen.',
        },
      ],
    });

    const result = await service.ask(
      'Quel est le statut de ma réclamation CLM-001 ?',
    );

    expect(result).toBe(
      'Votre réclamation est en cours d’examen.',
    );

    expect(insuranceService.getClaimStatus)
      .toHaveBeenCalledExactlyOnceWith('CLM-001');

    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);

    const secondCall = mockMessagesCreate.mock.calls[1][0];

    const messages = secondCall.messages;

    expect(messages).toHaveLength(3);

    const toolResultMessage = messages[2];

    expect(toolResultMessage.role).toBe('user');

    expect(toolResultMessage.content).toEqual([
      {
        type: 'tool_result',
        tool_use_id: 'toolu_test_001',
        content: JSON.stringify({
          id: 'CLM-001',
          policyId: 'POL-001',
          status: 'under_review',
          description: 'Water damage in basement',
          submittedAt: '2026-10-15',
        }),
      },
    ]);
  });

  it('rejects invalid tool params, sends is_error tool_result, then returns final answer', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_invalid_001',
          name: 'getClaimStatus',
          input: { claimId: 12345 },
        },
      ],
    });

    mockMessagesCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: 'Je ne peux pas consulter cette réclamation avec les informations fournies.',
        },
      ],
    });

    const result = await service.ask('Quel est le statut de ma réclamation ?');

    expect(result).toBe(
      'Je ne peux pas consulter cette réclamation avec les informations fournies.',
    );
    expect(insuranceService.getClaimStatus).not.toHaveBeenCalled();
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);

    const secondCall = mockMessagesCreate.mock.calls[1][0];
    const toolResultMessage = secondCall.messages[2];

    expect(toolResultMessage).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_invalid_001',
          is_error: true,
          content: 'Invalid claimId',
        },
      ],
    });
  });

  it('rejects unknown tool, sends is_error tool_result, then returns final answer', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_unknown_001',
          name: 'cancelClaim',
          input: { claimId: 'CLM-001' },
        },
      ],
    });

    mockMessagesCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: 'Cette action n’est pas disponible via l’assistant.',
        },
      ],
    });

    const result = await service.ask('Annule ma réclamation CLM-001.');

    expect(result).toBe('Cette action n’est pas disponible via l’assistant.');
    expect(insuranceService.getClaimStatus).not.toHaveBeenCalled();
    expect(insuranceService.getPolicyDetails).not.toHaveBeenCalled();
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);

    const secondCall = mockMessagesCreate.mock.calls[1][0];
    const toolResultMessage = secondCall.messages[2];

    expect(toolResultMessage).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_unknown_001',
          is_error: true,
          content: 'Unknown tool: cancelClaim',
        },
      ],
    });
  });

  it('stops after the maximum number of agent iterations', async () => {
    insuranceService.getClaimStatus.mockReturnValue({
      id: 'CLM-001',
      policyId: 'POL-001',
      status: 'under_review',
      description: 'Water damage in basement',
      submittedAt: '2026-10-15',
    });

    mockMessagesCreate.mockResolvedValue({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_loop',
          name: 'getClaimStatus',
          input: { claimId: 'CLM-001' },
        },
      ],
    });

    await expect(
      service.ask('Statut de ma réclamation CLM-001 ?'),
    ).rejects.toThrow('Maximum agent iterations reached');

    expect(mockMessagesCreate).toHaveBeenCalledTimes(5);
    expect(insuranceService.getClaimStatus).toHaveBeenCalledTimes(5);
  });

  it('executes searchInsuranceDocuments and returns final answer', async () => {
    embeddings.embed.mockResolvedValue([0.1, 0.2]);
    documentRetriever.searchGlobal.mockResolvedValue([
      {
        documentName: 'home-insurance.pdf',
        documentVersion: '2.1.0',
        pageNumber: 8,
        chunkIndex: 2,
        content: 'Foundation seepage may be excluded.',
        similarity: 0.92,
      },
    ]);

    mockMessagesCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_rag_001',
          name: 'searchInsuranceDocuments',
          input: { query: 'foundation water infiltration coverage' },
        },
      ],
    });

    mockMessagesCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: 'According to [SRC-001], gradual foundation seepage may be excluded.',
        },
      ],
    });

    const result = await service.ask(
      'Is water infiltration through foundations covered?',
    );

    expect(result).toContain('[SRC-001]');
    expect(embeddings.embed).toHaveBeenCalledWith(
      'foundation water infiltration coverage',
    );
    expect(documentRetriever.searchGlobal).toHaveBeenCalledOnce();
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);

    const toolResult = mockMessagesCreate.mock.calls[1][0].messages[2]
      .content[0] as { content: string };
    const parsed = JSON.parse(toolResult.content) as {
      sources: { id: string }[];
    };
    expect(parsed.sources[0]?.id).toBe('SRC-001');
  });

  it('returns expected text, calls Anthropic once, and does not call InsuranceService', async () => {
    const answer = await service.ask('Question test');

    expect(answer).toBe('Réponse mockée du modèle.');
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    expect(insuranceService.getClaimStatus).not.toHaveBeenCalled();
    expect(insuranceService.getPolicyDetails).not.toHaveBeenCalled();
  });
});
