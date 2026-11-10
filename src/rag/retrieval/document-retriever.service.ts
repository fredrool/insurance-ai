import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';

import type { DocumentChunkRow } from '../rag.types.js';

const { Pool } = pg;

type ChunkQueryRow = {
  document_name: string;
  document_version: string;
  page_number: number;
  chunk_index: number;
  content: string;
  similarity: string | number;
};

@Injectable()
export class DocumentRetrieverService
  implements OnModuleInit, OnModuleDestroy
{
  private pool?: pg.Pool;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.pool = new Pool({
      connectionString: this.config.getOrThrow<string>('DATABASE_URL'),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  async searchGlobal(
    embedding: number[],
    topK = 5,
  ): Promise<DocumentChunkRow[]> {
    const pool = this.requirePool();

    try {
      const result = await pool.query<ChunkQueryRow>(
        `
        SELECT
          document_name,
          document_version,
          page_number,
          chunk_index,
          content,
          1 - (embedding <=> $1::vector) AS similarity
        FROM document_chunks
        ORDER BY embedding <=> $1::vector
        LIMIT $2
        `,
        [JSON.stringify(embedding), topK],
      );

      return result.rows.map((row) => this.mapRow(row));
    } catch (error) {
      throw this.toQueryError(error);
    }
  }

  async searchByDocuments(
    embedding: number[],
    documentNames: string[],
    topKPerDocument = 3,
  ): Promise<DocumentChunkRow[]> {
    if (!documentNames.length) {
      return [];
    }

    const pool = this.requirePool();

    try {
      const result = await pool.query<ChunkQueryRow>(
        `
        WITH ranked AS (
          SELECT
            document_name,
            document_version,
            page_number,
            chunk_index,
            content,
            1 - (embedding <=> $1::vector) AS similarity,
            ROW_NUMBER() OVER (
              PARTITION BY document_name
              ORDER BY embedding <=> $1::vector
            ) AS rank_in_document
          FROM document_chunks
          WHERE document_name = ANY($2::text[])
        )
        SELECT
          document_name,
          document_version,
          page_number,
          chunk_index,
          content,
          similarity
        FROM ranked
        WHERE rank_in_document <= $3
        ORDER BY document_name, rank_in_document
        `,
        [JSON.stringify(embedding), documentNames, topKPerDocument],
      );

      return result.rows.map((row) => this.mapRow(row));
    } catch (error) {
      throw this.toQueryError(error);
    }
  }

  private requirePool(): pg.Pool {
    if (!this.pool) {
      throw new ServiceUnavailableException('Database pool is not ready');
    }
    return this.pool;
  }

  private mapRow(row: ChunkQueryRow): DocumentChunkRow {
    return {
      documentName: row.document_name,
      documentVersion: row.document_version,
      pageNumber: row.page_number,
      chunkIndex: row.chunk_index,
      content: row.content,
      similarity: Number(row.similarity),
    };
  }

  private toQueryError(error: unknown): Error {
    const message =
      error instanceof Error ? error.message : 'Document retrieval failed';
    return new ServiceUnavailableException(message);
  }
}
