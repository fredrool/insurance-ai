import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownFileToPdf } from './lib/pdf-from-markdown.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sourceDir = path.join(root, 'data', 'source');
const outputDir = path.join(root, 'data', 'documents');

const DOCUMENTS = [
  { source: 'home-insurance.md', pdf: 'home-insurance.pdf' },
  { source: 'auto-insurance.md', pdf: 'auto-insurance.pdf' },
  { source: 'claims-procedure.md', pdf: 'claims-procedure.pdf' },
];

async function main() {
  for (const { source, pdf } of DOCUMENTS) {
    const inputPath = path.join(sourceDir, source);
    const outputPath = path.join(outputDir, pdf);
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Missing source file: ${inputPath}`);
    }
    await markdownFileToPdf({ inputPath, outputPath });
    console.log(`Wrote ${path.relative(root, outputPath)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
