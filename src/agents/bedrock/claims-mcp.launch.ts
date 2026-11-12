import path from 'node:path';

export interface ClaimsMcpLaunchConfig {
  command: string;
  args: string[];
  cwd: string;
}

/** Stdio launch for the MCP Claims server (Node + project tsx; no shell/npx). */
export function resolveClaimsMcpServerLaunch(
  projectRoot = process.cwd(),
): ClaimsMcpLaunchConfig {
  const tsxCli = path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const serverEntry = path.join(projectRoot, 'mcp', 'claims', 'server.ts');

  return {
    command: process.execPath,
    args: [tsxCli, serverEntry],
    cwd: projectRoot,
  };
}
