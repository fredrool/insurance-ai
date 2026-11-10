import {
    BadRequestException,
    Body,
    Controller,
    Post,
  } from '@nestjs/common';
  import { BedrockAgentService } from './bedrock-agent.service.js';
  
  @Controller('agents/bedrock')
  export class BedrockAgentController {
    constructor(
      private readonly agent: BedrockAgentService,
    ) {}
  
    @Post('ask')
    async ask(
      @Body('question') question: string,
      @Body('conversationId') conversationId: string,
      @Body('debug') debug?: boolean,
    ) {
      if (!conversationId?.trim()) {
        throw new BadRequestException('conversationId is required');
      }

      const result = await this.agent.ask(
        question,
        conversationId,
        debug === true,
      );

      if (typeof result === 'string') {
        return { answer: result };
      }

      return result;
    }
  }