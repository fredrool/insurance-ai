import path from 'node:path';

export interface McpStdioLaunchConfig {
  command: string;
  args: string[];
  cwd: string;
}

/** Stdio launch for an MCP server entry (Node + project tsx; no shell/npx). */
export function resolveMcpStdioServerLaunch(
  serverEntryRelativePath: string,
  projectRoot = process.cwd(),
): McpStdioLaunchConfig {
  const tsxCli = path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const serverEntry = path.join(projectRoot, serverEntryRelativePath);

  return {
    command: process.execPath,
    args: [tsxCli, serverEntry],
    cwd: projectRoot,
  };
}
