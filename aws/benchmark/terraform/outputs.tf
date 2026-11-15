output "gateway_id" {
  description = "AgentCore Gateway ID (for IAM InvokeGateway resource scope)."
  value       = aws_bedrockagentcore_gateway.main.gateway_id
}

output "gateway_arn" {
  value = aws_bedrockagentcore_gateway.main.gateway_arn
}

output "gateway_url" {
  description = "Base Gateway URL from CreateGateway."
  value       = aws_bedrockagentcore_gateway.main.gateway_url
}

locals {
  gateway_base_url = trimsuffix(trim(aws_bedrockagentcore_gateway.main.gateway_url, "/"), "/mcp")
}

output "gateway_mcp_url" {
  description = "MCP Streamable HTTP endpoint for clients (…/mcp). Set AGENTCORE_GATEWAY_MCP_URL to this value."
  value       = "${local.gateway_base_url}/mcp"
}

output "claims_lambda_arn" {
  value = aws_lambda_function.claims.arn
}

output "crm_lambda_arn" {
  value = aws_lambda_function.crm.arn
}

output "corpus_bucket" {
  description = "Upload document_chunks export here (npm run export:corpus)."
  value       = aws_s3_bucket.corpus.id
}

output "corpus_object_key" {
  value = var.corpus_object_key
}

output "claim_lookup_state_machine_arn" {
  description = "Step Functions Standard workflow (Phase 2). Set CLAIM_LOOKUP_STATE_MACHINE_ARN for the run client."
  value       = aws_sfn_state_machine.claim_lookup.arn
}