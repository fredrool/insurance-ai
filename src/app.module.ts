import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BedrockAgentModule } from './agents/bedrock/bedrock-agent.module.js';
import { LangchainAgentModule } from './agents/langchain/langchain-agent.module.js';
import { NativeAgentModule } from './agents/native/native-agent.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { InsuranceModule } from './insurance/insurance.module.js';
import { RagModule } from './rag/rag.module.js';
import { ClaimLookupModule } from './workflows/claim-lookup/claim-lookup.module.js';
import { ClaimReviewModule } from './workflows/claim-review/claim-review.module.js';
import { ClaimMonitoringModule } from './monitoring/claim-monitoring.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    NativeAgentModule,
    LangchainAgentModule,
    BedrockAgentModule,
    ClaimLookupModule,
    ClaimReviewModule,
    ClaimMonitoringModule,
    InsuranceModule,
    RagModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
