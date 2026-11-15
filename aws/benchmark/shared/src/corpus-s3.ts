import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

import type { CorpusChunkRecord } from './corpus.js';

let cachedChunks: CorpusChunkRecord[] | null = null;
let cachedKey: string | null = null;

export function clearCorpusCache(): void {
  cachedChunks = null;
  cachedKey = null;
}

export async function loadCorpusFromS3(
  bucket: string,
  key: string,
  region: string,
): Promise<CorpusChunkRecord[]> {
  const cacheId = `${bucket}/${key}`;
  if (cachedChunks && cachedKey === cacheId) {
    return cachedChunks;
  }
  const client = new S3Client({ region });
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!response.Body) {
    throw new Error(`S3 object s3://${bucket}/${key} had no body`);
  }
  const text = await response.Body.transformToString();
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Corpus JSON must be an array of chunk records');
  }
  cachedChunks = parsed as CorpusChunkRecord[];
  cachedKey = cacheId;
  return cachedChunks;
}