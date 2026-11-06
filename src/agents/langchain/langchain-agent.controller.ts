import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { LangchainAgentService } from './langchain-agent.service.js';

@Controller('agents/langchain')
export class LangchainAgentController {
  constructor(
    private readonly agent: LangchainAgentService,
  ) {}

  @Post('ask')
  async ask(
    @Body('question') question: string,
    @Body('conversationId') conversationId: string,
  ) {
    if (!conversationId?.trim()) {
      throw new BadRequestException('conversationId is required');
    }

    return {
      answer: await this.agent.ask(question, conversationId),
    };
  }
}