import { vi } from 'vitest';
import { InsuranceService } from '../../insurance/insurance.service.js';
import {
  createInsuranceTools,
  type RagToolDependencies,
} from './insurance-tools.factory.js';

describe('createInsuranceTools', () => {
  const insuranceService = {
    getClaimStatus: vi.fn(),
    getPolicyDetails: vi.fn(),
  } as unknown as InsuranceService;

  it('exposes only claim and policy tools without RAG dependencies', () => {
    const tools = createInsuranceTools(insuranceService);

    expect(tools.map((tool) => tool.name)).toEqual([
      'getClaimStatus',
      'getPolicyDetails',
    ]);
  });

  it('can omit structured data tools for MCP-backed agents', () => {
    const embeddings = { embed: vi.fn() };
    const retriever = { searchGlobal: vi.fn(), searchByDocuments: vi.fn() };
    const tools = createInsuranceTools(
      insuranceService,
      { embeddings, retriever } as unknown as RagToolDependencies,
      { structuredDataTools: false },
    );

    expect(tools.map((tool) => tool.name)).toEqual(['searchInsuranceDocuments']);
  });

  it('searchInsuranceDocuments returns JSON passages without calling an LLM', async () => {
    const embeddings = { embed: vi.fn().mockResolvedValue([0.1, 0.2]) };
    const retriever = {
      searchGlobal: vi.fn().mockResolvedValue([
        {
          documentName: 'home-insurance.pdf',
          documentVersion: '2.1.0',
          pageNumber: 5,
          chunkIndex: 12,
          content: 'Section 5.3.1 excludes foundation infiltration.',
          similarity: 0.87,
        },
      ]),
      searchByDocuments: vi.fn(),
    };

    const ragDeps = {
      embeddings,
      retriever,
    } as unknown as RagToolDependencies;

    const tools = createInsuranceTools(insuranceService, ragDeps);

    const searchTool = tools[2] as {
      name: string;
      invoke: (input: {
        query: string;
        documentNames?: string[];
        topK?: number;
      }) => Promise<string>;
    };
    expect(searchTool.name).toBe('searchInsuranceDocuments');

    const raw = await searchTool.invoke({ query: 'foundation water' });
    const parsed = JSON.parse(raw as string);

    expect(parsed.query).toBe('foundation water');
    expect(parsed.sources).toEqual([
      {
        id: 'SRC-001',
        documentName: 'home-insurance.pdf',
        documentVersion: '2.1.0',
        pageNumber: 5,
        chunkIndex: 12,
        similarity: 0.87,
        content: 'Section 5.3.1 excludes foundation infiltration.',
      },
    ]);

    expect(embeddings.embed).toHaveBeenCalledWith('foundation water');
    expect(retriever.searchGlobal).toHaveBeenCalledWith([0.1, 0.2], 5);
    expect(retriever.searchByDocuments).not.toHaveBeenCalled();
  });

  it('uses per-document search when documentNames are provided', async () => {
    const embeddings = { embed: vi.fn().mockResolvedValue([0.3]) };
    const retriever = {
      searchGlobal: vi.fn(),
      searchByDocuments: vi.fn().mockResolvedValue([]),
    };

    const ragDeps = {
      embeddings,
      retriever,
    } as unknown as RagToolDependencies;

    const tools = createInsuranceTools(insuranceService, ragDeps);

    const searchTool = tools[2] as {
      invoke: (input: {
        query: string;
        documentNames?: string[];
        topK?: number;
      }) => Promise<string>;
    };

    await searchTool.invoke({
      query: 'deductible',
      documentNames: ['auto-insurance.pdf'],
      topK: 4,
    });

    expect(retriever.searchByDocuments).toHaveBeenCalledWith(
      [0.3],
      ['auto-insurance.pdf'],
      4,
    );
    expect(retriever.searchGlobal).not.toHaveBeenCalled();
  });
});
