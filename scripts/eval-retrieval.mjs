import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { generateEmbedding } from './lib/embeddings.mjs';
import {
  aggregateScoredCases,
  scoreRetrievalCase,
} from '../eval/retrieval-scoring.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const datasetPath = path.join(root, 'eval', 'retrieval-dataset.json');

const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function searchGlobal(client, embedding, topK) {
  const result = await client.query(
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

  return result.rows;
}

async function searchByDocuments(client, embedding, documentNames, topKPerDoc) {
  const result = await client.query(
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
    [JSON.stringify(embedding), documentNames, topKPerDoc],
  );

  return result.rows;
}

function printCaseReport(report, testCase) {
  console.log(`\n=== ${report.id} ===`);
  console.log(`Question: ${testCase.question}`);

  if (testCase.unsupportedQuestion) {
    console.log('Type: unsupported question (retrieval ranking only)');
    console.log('Answer abstention: not tested');
  }

  console.log(`Strategy: ${testCase.strategy} (topK=${testCase.topK ?? 5})`);

  for (const hit of report.topResults) {
    console.log(
      `  #${hit.rank} ${hit.documentName} p${hit.pageNumber} chunk ${hit.chunkIndex} ` +
        `sim=${hit.similarity.toFixed(3)} — ${hit.excerpt}`,
    );
  }

  if (!report.scored) {
    return;
  }

  console.log(
    `Document recall@${report.k}: ${(report.documentRecall.score * 100).toFixed(1)}% ` +
      `(found: ${report.documentRecall.hits.join(', ') || 'none'})`,
  );
  if (report.documentRecall.missing.length) {
    console.log(`  Missing documents: ${report.documentRecall.missing.join(', ')}`);
  }

  console.log(
    `Clause/evidence recall@${report.k}: ${(report.clauseRecall.score * 100).toFixed(1)}% ` +
      `(found: ${report.clauseRecall.hits.join(', ') || 'none'})`,
  );
  if (report.clauseRecall.missing.length) {
    console.log(`  Missing patterns: ${report.clauseRecall.missing.join(', ')}`);
  }

  console.log(report.passed ? 'Result: PASS' : 'Result: FAIL');
}

await db.connect();

const caseReports = [];

try {
  for (const testCase of dataset) {
    const embedding = await generateEmbedding(testCase.question);
    const topK = testCase.topK ?? 5;

    const results =
      testCase.strategy === 'by_document' && testCase.documentNames?.length
        ? await searchByDocuments(
            db,
            embedding,
            testCase.documentNames,
            topK,
          )
        : await searchGlobal(db, embedding, topK);

    const report = scoreRetrievalCase(testCase, results);
    caseReports.push(report);
    printCaseReport(report, testCase);
  }

  const aggregate = aggregateScoredCases(caseReports);

  console.log('\n=== Aggregate (scored cases only) ===');
  console.log(`Cases: ${aggregate.caseCount}`);
  console.log(
    `Mean document recall@5: ${(aggregate.meanDocumentRecallAt5 * 100).toFixed(1)}%`,
  );
  console.log(
    `Mean clause/evidence recall@5: ${(aggregate.meanClauseRecallAt5 * 100).toFixed(1)}%`,
  );

  const failed = caseReports.filter((report) => report.scored && !report.passed);

  if (failed.length) {
    console.error(`\nEvaluation failed (${failed.length} case(s)).`);
    process.exitCode = 1;
  } else {
    console.log('\nEvaluation passed.');
  }
} finally {
  await db.end();
}
