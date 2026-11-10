export interface BedrockToolCallSummary {
  name: string;
  args: Record<string, unknown>;
}

export interface BedrockRetrievalSource {
  id: string;
  documentName: string;
  documentVersion: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
}

export interface BedrockAskResult {
  answer: string;
  toolCalls: BedrockToolCallSummary[];
  sources: BedrockRetrievalSource[];
}
