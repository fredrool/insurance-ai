import { readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

import { PDFLoader } from
  "@langchain/community/document_loaders/fs/pdf";

import { RecursiveCharacterTextSplitter } from
  "@langchain/textsplitters";

import { generateEmbedding } from "./lib/embeddings.mjs";

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

const directory = "data/documents";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,
  chunkOverlap: 150,
});

await db.connect();

try {
  const files = (await readdir(directory))
    .filter(file => file.endsWith(".pdf"));

  for (const file of files) {
    const loader = new PDFLoader(
      path.join(directory, file),
      { splitPages: true }
    );

    const pages = await loader.load();
    const chunks = await splitter.splitDocuments(pages);

    // Pour notre corpus fictif, on extrait la version
    // de l'en-tête du document.
    const header = pages[0]?.pageContent ?? "";
    const version = header.match(/Version:\s*([\d.]+)/)?.[1];

    if (!version) {
      throw new Error(`Missing version in ${file}`);
    }

    console.log(`Indexing ${file}: ${chunks.length} chunks`);

    for (const [index, chunk] of chunks.entries()) {
      const embedding = await generateEmbedding(
        chunk.pageContent
      );

      await db.query(
        `
        INSERT INTO document_chunks (
          document_id,
          document_name,
          document_version,
          page_number,
          chunk_index,
          content,
          embedding
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
        ON CONFLICT (document_id, chunk_index)
        DO UPDATE SET
          document_version = EXCLUDED.document_version,
          page_number = EXCLUDED.page_number,
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding
        `,
        [
          file,
          file,
          version,
          chunk.metadata.loc.pageNumber,
          index,
          chunk.pageContent,
          JSON.stringify(embedding),
        ]
      );
    }

    console.log(`Finished ${file}`);
  }
} finally {
  await db.end();
}