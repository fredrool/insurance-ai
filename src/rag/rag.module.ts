import { Module } from '@nestjs/common';

import { BedrockEmbeddingsService } from './embeddings/bedrock-embeddings.service.js';
import { DocumentRetrieverService } from './retrieval/document-retriever.service.js';
import { RagController } from './rag.controller.js';
import { RagService } from './rag.service.js';

@Module({
  controllers: [RagController],
  providers: [RagService, BedrockEmbeddingsService, DocumentRetrieverService],
  exports: [RagService, BedrockEmbeddingsService, DocumentRetrieverService],
})
export class RagModule {}
