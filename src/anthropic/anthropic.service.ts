import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AnthropicService {
  private readonly client: Anthropic;

  constructor(private readonly config: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
  }

  async ask(question: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.config.getOrThrow<string>('ANTHROPIC_MODEL'),
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: question,
        },
      ],
    });

    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  }
}