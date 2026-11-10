import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';

import { DocumentRetrieverService } from './document-retriever.service.js';

describe('DocumentRetrieverService', () => {
  let service: DocumentRetrieverService;
  const query = vi.fn();

  beforeEach(async () => {
    query.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentRetrieverService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'DATABASE_URL') {
                return 'postgresql://insurance:insurance@localhost:5432/insurance_ai';
              }
              throw new Error(`Unknown key ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get(DocumentRetrieverService);
    (service as unknown as { pool: { query: typeof query } }).pool = {
      query,
    };
  });

  it('runs global similarity search with parameterized SQL', async () => {
    query.mockResolvedValue({
      rows: [
        {
          document_name: 'auto-insurance.pdf',
          document_version: '2.1.0',
          page_number: 3,
          chunk_index: 7,
          content: 'Collision deductible applies per occurrence.',
          similarity: '0.91',
        },
      ],
    });

    const rows = await service.searchGlobal([0.1, 0.2], 5);

    expect(rows).toEqual([
      {
        documentName: 'auto-insurance.pdf',
        documentVersion: '2.1.0',
        pageNumber: 3,
        chunkIndex: 7,
        content: 'Collision deductible applies per occurrence.',
        similarity: 0.91,
      },
    ]);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('ORDER BY embedding <=> $1::vector');
    expect(sql).toContain('LIMIT $2');
    expect(params[1]).toBe(5);
  });

  it('runs per-document ranked search when document names are provided', async () => {
    query.mockResolvedValue({ rows: [] });

    await service.searchByDocuments(
      [0.5, 0.6],
      ['home-insurance.pdf', 'claims-procedure.pdf'],
      3,
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('PARTITION BY document_name');
    expect(sql).toContain('WHERE document_name = ANY($2::text[])');
    expect(params[1]).toEqual([
      'home-insurance.pdf',
      'claims-procedure.pdf',
    ]);
    expect(params[2]).toBe(3);
  });
});
