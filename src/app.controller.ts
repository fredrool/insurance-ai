import { Body, Controller, Get, Post } from '@nestjs/common';
import { NativeAgentService } from './agents/native/native-agent.service.js';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly nativeAgentService: NativeAgentService,
  ) {}

  @Post('ask')
  async ask(@Body('question') question: string) {
    return {
      answer: await this.nativeAgentService.ask(question),
    };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
