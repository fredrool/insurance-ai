import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnthropicModule } from './anthropic/anthropic.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AnthropicModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
