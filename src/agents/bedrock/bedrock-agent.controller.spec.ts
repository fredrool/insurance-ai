import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';

import { BedrockAgentController } from './bedrock-agent.controller.js';
import { BedrockAgentService } from './bedrock-agent.service.js';

describe('BedrockAgentController', () => {
  let controller: BedrockAgentController;
  const agent = { ask: vi.fn() };

  beforeEach(async () => {
    agent.ask.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BedrockAgentController],
      providers: [{ provide: BedrockAgentService, useValue: agent }],
    }).compile();

    controller = module.get(BedrockAgentController);
  });

  it('returns answer only when debug is false', async () => {
    agent.ask.mockResolvedValue('Short answer');

    const response = await controller.ask(
      'question',
      'conv-1',
      false,
    );

    expect(agent.ask).toHaveBeenCalledWith('question', 'conv-1', false);
    expect(response).toEqual({ answer: 'Short answer' });
  });

  it('returns toolCalls and sources when debug is true', async () => {
    agent.ask.mockResolvedValue({
      answer: 'Grounded answer',
      toolCalls: [{ name: 'searchInsuranceDocuments', args: { query: 'flood' } }],
      sources: [
        {
          id: 'SRC-001',
          documentName: 'home-insurance.pdf',
          documentVersion: '2.1.0',
          pageNumber: 4,
          chunkIndex: 2,
          similarity: 0.88,
        },
      ],
    });

    const response = await controller.ask('question', 'conv-2', true);

    expect(agent.ask).toHaveBeenCalledWith('question', 'conv-2', true);
    expect(response).toEqual({
      answer: 'Grounded answer',
      toolCalls: [
        { name: 'searchInsuranceDocuments', args: { query: 'flood' } },
      ],
      sources: [
        {
          id: 'SRC-001',
          documentName: 'home-insurance.pdf',
          documentVersion: '2.1.0',
          pageNumber: 4,
          chunkIndex: 2,
          similarity: 0.88,
        },
      ],
    });
  });
});
