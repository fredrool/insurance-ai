export interface DocumentChunkRow {
  documentName: string;
  documentVersion: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  similarity: number;
}

export interface RagSource extends DocumentChunkRow {
  id: string;
}

export interface RagAskResponse {
  answer: string;
  sources: RagSource[];
}
