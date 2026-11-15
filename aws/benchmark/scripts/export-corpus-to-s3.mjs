/**
 * Export Postgres document_chunks (512-d vectors) to S3 for Phase 2 RAG Lambda.
 *
 * Requires DATABASE_URL (local Nest RAG DB) and AWS creds with s3:PutObject.
 *
 *   export DATABASE_URL=postgresql://...
 *   export CORPUS_BUCKET=insurance-ai-benchmark-corpus-123456789
 *   npm run export:corpus
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';

const { Client } = pg;

const bucket = process.env.CORPUS_BUCKET;
const key = process.env.CORPUS_OBJECT_KEY ?? 'corpus/document-chunks.json';
const region = process.env.AWS_REGION ?? 'us-east-1';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
if (!bucket) {
  console.error('CORPUS_BUCKET is required (terraform output corpus_bucket)');
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(`
  SELECT
    id::text,
    document_id AS "documentId",
    document_name AS "documentName",
    document_version AS "documentVersion",
    page_number AS "pageNumber",
    chunk_index AS "chunkIndex",
    content,
    embedding::text AS embedding_text
  FROM document_chunks
  ORDER BY id
`);

await client.end();

const records = rows.map((row) => {
  const embedding = JSON.parse(row.embedding_text);
  return {
    id: row.id,
    documentId: row.documentId,
    documentName: row.documentName,
    documentVersion: row.documentVersion,
    pageNumber: row.pageNumber,
    chunkIndex: row.chunkIndex,
    content: row.content,
    embedding,
  };
});

const body = JSON.stringify(records);
const s3 = new S3Client({ region });
await s3.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'application/json',
  }),
);

console.log(
  `Uploaded ${records.length} chunks to s3://${bucket}/${key} (${body.length} bytes)`,
);