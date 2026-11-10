export interface RecallScore {
  score: number;
  hits: string[];
  missing: string[];
}

export interface RetrievalResultRow {
  document_name: string;
  content: string;
  page_number?: number;
  chunk_index?: number;
  similarity?: number;
}

export interface RetrievalTestCase {
  id: string;
  expectRelevantEvidence: boolean;
  expectedDocuments?: string[];
  requiredClausePatterns?: string[];
  topK?: number;
}

export interface TopResultSummary {
  rank: number;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  excerpt: string;
}

export interface UnscoredCaseReport {
  id: string;
  scored: false;
  topResults: TopResultSummary[];
}

export interface ScoredCaseReport {
  id: string;
  scored: true;
  passed: boolean;
  k: number;
  documentRecall: RecallScore;
  clauseRecall: RecallScore;
  topResults: TopResultSummary[];
}

export type CaseReport = UnscoredCaseReport | ScoredCaseReport;

export interface AggregateMetrics {
  caseCount: number;
  meanDocumentRecallAt5: number;
  meanClauseRecallAt5: number;
}

export function documentRecallAtK(
  results: RetrievalResultRow[],
  expectedDocuments: string[],
  k: number,
): RecallScore;

export function clauseRecallAtK(
  results: Array<{ content: string }>,
  patterns: string[],
  k: number,
): RecallScore;

export function scoreRetrievalCase(
  testCase: RetrievalTestCase,
  results: RetrievalResultRow[],
): CaseReport;

export function aggregateScoredCases(
  caseReports: Array<
    | CaseReport
    | {
        id: string;
        scored: boolean;
        passed?: boolean;
        documentRecall?: { score: number };
        clauseRecall?: { score: number };
      }
  >,
): AggregateMetrics;
