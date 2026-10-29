import { Body, Controller, Get, Post } from '@nestjs/common';
import { AnthropicService } from './anthropic/anthropic.service.js';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly anthropicService: AnthropicService,
  ) {}

  @Post('ask')
  async ask(@Body('question') question: string) {
    return {
      answer: await this.anthropicService.ask(question),
    };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
