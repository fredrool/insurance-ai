import pg from "pg";
import { generateEmbedding } from "./lib/embeddings.mjs";

const question = process.argv.slice(2).join(" ");

if (!question) {
  console.error('Usage: node search-policy.mjs "question"');
  process.exit(1);
}

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

await db.connect();

try {
  const embedding = await generateEmbedding(question);

  const result = await db.query(
    `
    SELECT
      document_name,
      document_version,
      page_number,
      chunk_index,
      content,
      1 - (embedding <=> $1::vector) AS similarity
    FROM document_chunks
    WHERE document_name = 'claims-procedure.pdf'
    ORDER BY embedding <=> $1::vector
    LIMIT 5
    `,
    [JSON.stringify(embedding)],
  );

  console.log(`\nQuestion: ${question}\n`);

  for (const [index, row] of result.rows.entries()) {
    console.log(`--- Result ${index + 1} ---`);
    console.log(`Source: ${row.document_name}`);
    console.log(`Version: ${row.document_version}`);
    console.log(`Page: ${row.page_number}`);
    console.log(`Similarity: ${Number(row.similarity).toFixed(3)}`);
    console.log(`\n${row.content}\n`);
  }
} finally {
  await db.end();
}