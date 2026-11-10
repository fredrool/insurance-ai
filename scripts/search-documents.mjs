import pg from "pg";
import { generateEmbedding } from "./lib/embeddings.mjs";

const question =
  process.argv.slice(2).join(" ") ||
  "My basement was damaged by flooding";

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

await db.connect();

try {
  // 1. Transformer la question en vecteur
  const embedding = await generateEmbedding(question);

  // 2. Rechercher les documents les plus proches
  const result = await db.query(
    `
    SELECT
      id,
      content,
      1 - (embedding <=> $1::vector) AS similarity
    FROM insurance_documents
    ORDER BY embedding <=> $1::vector
    LIMIT 3
    `,
    [JSON.stringify(embedding)],
  );

  console.log("\nQuestion:", question);
  console.table(result.rows);
} finally {
  await db.end();
}