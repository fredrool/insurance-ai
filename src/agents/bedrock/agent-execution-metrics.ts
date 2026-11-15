/** Shared execution metric fields (Bedrock agent debug + claim-lookup workflow). */
export interface AgentExecutionMetrics {
  durationMs: number;
  llmCalls: number;
  mcpCalls: number;
  inputTokens: number;
  outputTokens: number;
}