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
  {
    name: 'workflow-load-claim',
    entry: path.join(
      root,
      'lambdas',
      'workflow-load-claim',
      'src',
      'handler.ts',
    ),
  },
  {
    name: 'workflow-load-customer',
    entry: path.join(
      root,
      'lambdas',
      'workflow-load-customer',
      'src',
      'handler.ts',
    ),
  },
  {
    name: 'workflow-retrieve',
    entry: path.join(root, 'lambdas', 'workflow-retrieve', 'src', 'handler.ts'),
  },
  {
    name: 'workflow-generate-answer',
    entry: path.join(
      root,
      'lambdas',
      'workflow-generate-answer',
      'src',
      'handler.ts',
    ),
  },
];

await mkdir(dist, { recursive: true });

for (const bundle of bundles) {
  const outDir = path.join(dist, bundle.name);
  await mkdir(outDir, { recursive: true });

  // Workflow steps bundle AWS SDK + MCP + SigV4. ESM output breaks in Lambda because
  // esbuild's require shim cannot load Node built-ins (e.g. buffer) from Smithy/crypto.
  const useCommonJs = bundle.name.startsWith('workflow-');

  await esbuild.build({
    entryPoints: [bundle.entry],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: useCommonJs ? 'cjs' : 'esm',
    mainFields: useCommonJs ? ['main', 'module'] : ['module', 'main'],
    outfile: path.join(outDir, useCommonJs ? 'index.js' : 'index.mjs'),
    external: [],
  });

  const pkg = useCommonJs ? { dependencies: {} } : { type: 'module', dependencies: {} };
  await writeFile(
    path.join(outDir, 'package.json'),
    `${JSON.stringify(pkg, null, 2)}\n`,
  );
}

console.log('Lambda bundles written to aws/benchmark/dist/lambdas/');