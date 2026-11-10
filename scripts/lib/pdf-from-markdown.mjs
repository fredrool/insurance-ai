import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const PAGE = { top: 72, bottom: 72, left: 72, right: 72 };
const BODY_SIZE = 10.5;
const LINE_GAP = 4;

function parseFrontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw };
  }
  const meta = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    meta[key] = value;
  }
  return { meta, body: match[2].trim() };
}

function parseBlocks(body) {
  const lines = body.split(/\r?\n/);
  const blocks = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    const h1 = trimmed.match(/^# (.+)$/);
    const h2 = trimmed.match(/^## (.+)$/);
    const h3 = trimmed.match(/^### (.+)$/);
    const bullet = trimmed.match(/^[-*] (.+)$/);
    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    const clause = trimmed.match(/^(\d+(?:\.\d+)+)\s+(.+)$/);

    if (h1) {
      flushParagraph();
      blocks.push({ type: 'h1', text: h1[1] });
    } else if (h2) {
      flushParagraph();
      blocks.push({ type: 'h2', text: h2[1] });
    } else if (h3) {
      flushParagraph();
      blocks.push({ type: 'h3', text: h3[1] });
    } else if (clause) {
      flushParagraph();
      blocks.push({
        type: 'clause',
        id: clause[1],
        text: clause[2],
      });
    } else if (bullet) {
      flushParagraph();
      blocks.push({ type: 'bullet', text: bullet[1] });
    } else if (numbered) {
      flushParagraph();
      blocks.push({ type: 'numbered', text: numbered[1] });
    } else {
      paragraph.push(trimmed);
    }
  }
  flushParagraph();
  return blocks;
}

function contentWidth(doc) {
  return doc.page.width - PAGE.left - PAGE.right;
}

function ensureSpace(doc, needed) {
  const y = doc.y;
  const limit = doc.page.height - PAGE.bottom;
  if (y + needed > limit) {
    doc.addPage();
    doc.y = PAGE.top;
  }
}

function renderDisclaimerBox(doc, lines) {
  ensureSpace(doc, 90);
  const width = contentWidth(doc);
  const startY = doc.y;
  doc
    .rect(PAGE.left, startY, width, 78)
    .fillAndStroke('#fff3cd', '#856404');
  doc.fillColor('#333333');
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(lines.join('\n'), PAGE.left + 10, startY + 10, {
      width: width - 20,
      lineGap: 2,
    });
  doc.y = startY + 88;
}

function renderMeta(doc, meta) {
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#444444')
    .text(
      `Document ID: ${meta.documentId ?? 'N/A'}    Version: ${meta.version ?? 'N/A'}`,
      PAGE.left,
      doc.y,
      { width: contentWidth(doc) },
    );
  doc.moveDown(0.5);
  if (meta.effectiveDate) {
    doc
      .font('Helvetica')
      .text(`Effective date (fictional): ${meta.effectiveDate}`, PAGE.left);
    doc.moveDown(0.5);
  }
}

export function markdownFileToPdf({ inputPath, outputPath }) {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const { meta, body } = parseFrontMatter(raw);
  const blocks = parseBlocks(body);
  const baseName = path.basename(inputPath, path.extname(inputPath));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: PAGE,
    info: {
      Title: meta.title ?? baseName,
      Author: 'ABC Assurances (Fictional)',
      Subject: 'Educational RAG corpus — not legally valid',
      Keywords: 'fictional, educational, insurance, RAG',
      Creator: 'insurance-ai generate-policy-pdfs',
      Producer: 'PDFKit',
    },
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#1a365d')
    .text(meta.title ?? baseName, PAGE.left, PAGE.top, {
      width: contentWidth(doc),
    });
  doc.moveDown(0.3);
  renderMeta(doc, meta);
  renderDisclaimerBox(doc, [
    'FICTIONAL DOCUMENT — FOR EDUCATIONAL USE ONLY',
    'ABC Assurances is a fictional insurer. This policy text is invented for software',
    'and RAG training demos. It is not legally binding and must not be used for',
    'real underwriting, claims, or compliance decisions.',
  ]);
  doc.moveDown(0.8);

  let pageNumber = 1;
  const addFooter = () => {
    const footerY = doc.page.height - 48;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#666666')
      .text(
        `${meta.documentId ?? baseName} v${meta.version ?? '?'} — Page ${pageNumber} — FICTIONAL / EDUCATIONAL`,
        PAGE.left,
        footerY,
        { width: contentWidth(doc), align: 'center' },
      );
  };

  for (const block of blocks) {
    switch (block.type) {
      case 'h1':
        ensureSpace(doc, 28);
        doc.moveDown(0.6);
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#1a365d').text(block.text);
        doc.moveDown(0.4);
        break;
      case 'h2':
        ensureSpace(doc, 22);
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#2c5282').text(block.text);
        doc.moveDown(0.3);
        break;
      case 'h3':
        ensureSpace(doc, 18);
        doc.moveDown(0.35);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#2d3748').text(block.text);
        doc.moveDown(0.2);
        break;
      case 'clause': {
        ensureSpace(doc, 36);
        doc
          .font('Helvetica-Bold')
          .fontSize(BODY_SIZE)
          .fillColor('#1a202c')
          .text(`${block.id}  `, { continued: true });
        doc.font('Helvetica').text(block.text, {
          width: contentWidth(doc),
          lineGap: LINE_GAP,
        });
        doc.moveDown(0.25);
        break;
      }
      case 'bullet':
        ensureSpace(doc, 28);
        doc
          .font('Helvetica')
          .fontSize(BODY_SIZE)
          .text(`•  ${block.text}`, {
            width: contentWidth(doc),
            indent: 14,
            lineGap: LINE_GAP,
          });
        break;
      case 'numbered':
        ensureSpace(doc, 28);
        doc
          .font('Helvetica')
          .fontSize(BODY_SIZE)
          .text(block.text, {
            width: contentWidth(doc),
            lineGap: LINE_GAP,
          });
        doc.moveDown(0.15);
        break;
      case 'paragraph':
      default:
        ensureSpace(doc, 40);
        doc
          .font('Helvetica')
          .fontSize(BODY_SIZE)
          .fillColor('#1a202c')
          .text(block.text, {
            width: contentWidth(doc),
            align: 'justify',
            lineGap: LINE_GAP,
          });
        doc.moveDown(0.35);
        break;
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    pageNumber = i + 1;
    addFooter();
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}
