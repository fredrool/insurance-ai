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
    ) {
      if (!conversationId?.trim()) {
        throw new BadRequestException('conversationId is required');
      }
  
      return {
        answer: await this.agent.ask(question, conversationId),
      };
    }
  }