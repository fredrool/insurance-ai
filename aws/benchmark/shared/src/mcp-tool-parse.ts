export function parseMcpToolJson(result: unknown): unknown {
  if (!result || typeof result !== 'object' || !('content' in result)) {
    return result;
  }
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content) || content.length === 0) {
    return null;
  }
  const first = content[0];
  if (
    typeof first === 'object' &&
    first !== null &&
    'type' in first &&
    first.type === 'text' &&
    'text' in first &&
    typeof first.text === 'string'
  ) {
    try {
      return JSON.parse(first.text);
    } catch {
      return first.text;
    }
  }
  return result;
}

export function findToolBySuffix(
  tools: { name: string }[],
  suffix: string,
): string | undefined {
  const exact = tools.find((tool) => tool.name === suffix);
  if (exact) return exact.name;
  return tools.find(
    (tool) => tool.name.endsWith(suffix) || tool.name.includes(`___${suffix}`),
  )?.name;
}