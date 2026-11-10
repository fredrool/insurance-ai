import { readdir } from "node:fs/promises";
import path from "node:path";

import { PDFLoader } from
  "@langchain/community/document_loaders/fs/pdf";

import { RecursiveCharacterTextSplitter } from
  "@langchain/textsplitters";

const directory = "data/documents";

const files = (await readdir(directory))
  .filter((file) => file.endsWith(".pdf"));

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,
  chunkOverlap: 150,
});

for (const file of files) {
  const loader = new PDFLoader(path.join(directory, file), {
    splitPages: true,
  });

  const pages = await loader.load();

  const chunks = await splitter.splitDocuments(pages);

  console.log(`\nDocument: ${file}`);
  console.log(`Pages: ${pages.length}`);
  console.log(`Chunks: ${chunks.length}`);

  console.log("\nFirst chunk:");
  console.log(chunks[0]?.pageContent);

  console.log("\nMetadata:");
  console.log(chunks[0]?.metadata);
}