import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LangchainAgentModule } from './agents/langchain/langchain-agent.module.js';
import { NativeAgentModule } from './agents/native/native-agent.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { InsuranceModule } from './insurance/insurance.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    NativeAgentModule,
    LangchainAgentModule,
    InsuranceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
