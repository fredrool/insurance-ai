import type { Context } from 'aws-lambda';

type GatewayCustomContext = {
  bedrockAgentCoreToolName?: string;
};

/** Strip AgentCore Gateway `targetName___toolName` prefix (see AWS Lambda target docs). */
export function resolveGatewayToolName(context: Context): string {
  const clientContext = context.clientContext as
    | { custom?: GatewayCustomContext; Custom?: GatewayCustomContext }
    | undefined;
  const custom = clientContext?.custom ?? clientContext?.Custom;
  const fullName = custom?.bedrockAgentCoreToolName ?? '';
  const delimiter = '___';
  const index = fullName.indexOf(delimiter);
  if (index >= 0) {
    return fullName.slice(index + delimiter.length);
  }
  return fullName;
}