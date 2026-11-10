import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';

import { RagController } from './rag.controller.js';
import { RagService } from './rag.service.js';

describe('RagController', () => {
  let controller: RagController;
  const ragService = { ask: vi.fn() };

  beforeEach(async () => {
    ragService.ask.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagController],
      providers: [{ provide: RagService, useValue: ragService }],
    }).compile();

    controller = module.get(RagController);
  });

  it('validates question and forwards documentNames', async () => {
    ragService.ask.mockResolvedValue({ answer: 'ok', sources: [] });

    await controller.ask('What is liability?', [
      'auto-insurance.pdf',
    ]);

    expect(ragService.ask).toHaveBeenCalledWith('What is liability?', [
      'auto-insurance.pdf',
    ]);
  });

  it('rejects missing question', async () => {
    await expect(controller.ask('  ', undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
