import * as esbuild from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist', 'lambdas');

const bundles = [
  {
    name: 'claims',
    entry: path.join(root, 'lambdas', 'claims', 'src', 'handler.ts'),
  },
  {
    name: 'crm',
    entry: path.join(root, 'lambdas', 'crm', 'src', 'handler.ts'),
  },
];

await mkdir(dist, { recursive: true });

for (const bundle of bundles) {
  const outDir = path.join(dist, bundle.name);
  await mkdir(outDir, { recursive: true });

  await esbuild.build({
    entryPoints: [bundle.entry],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outfile: path.join(outDir, 'index.mjs'),
    external: [],
  });

  const pkg = {
    type: 'module',
    dependencies: {},
  };
  await writeFile(
    path.join(outDir, 'package.json'),
    `${JSON.stringify(pkg, null, 2)}\n`,
  );
}

console.log('Lambda bundles written to aws/benchmark/dist/lambdas/');