import pg from "pg";
import { generateEmbedding } from "./lib/embeddings.mjs";

  function cosineSimilarity(a, b) {
    const dotProduct = a.reduce(
      (sum, value, i) => sum + value * b[i],
      0,
    );
  
    const normA = Math.sqrt(
      a.reduce((sum, value) => sum + value ** 2, 0),
    );
  
    const normB = Math.sqrt(
      b.reduce((sum, value) => sum + value ** 2, 0),
    );
  
    return dotProduct / (normA * normB);
  }
  
  const texts = [
    "Water damage caused by a basement flood",
    "Flooding in the basement of a house",
    "Collision between two vehicles",
  ];
  
  const embeddings = [];
  
  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    embeddings.push(embedding);
  
    console.log(`\nText: ${text}`);
    console.log("Dimensions:", embedding.length);
    console.log("First 5 values:", embedding.slice(0, 5));
  }

  const db = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  await db.connect();
  
  try {
    for (let i = 0; i < texts.length; i++) {
      await db.query(
        `INSERT INTO insurance_documents (content, embedding)
         VALUES ($1, $2::vector)`,
        [texts[i], JSON.stringify(embeddings[i])],
      );
    }
  
    console.log("Documents stored in PostgreSQL!");
  } finally {
    await db.end();
  }

  console.log("\nSimilarity scores:");

  console.log(
    "Water damage vs basement flooding:",
    cosineSimilarity(embeddings[0], embeddings[1]),
  );

  console.log(
    "Water damage vs vehicle collision:",
    cosineSimilarity(embeddings[0], embeddings[2]),
  );