# Insurance-AI Version C — AgentCore Gateway benchmark (Phase 1 + Phase 2)

This folder is **isolated** from Versions A/B (`POST /agents/bedrock/ask`, `POST /workflows/claim-lookup`). Nothing here changes the NestJS app or local stdio MCP servers.

## Learning goal

Understand how **Amazon Bedrock AgentCore Gateway** turns **AWS Lambda** functions into **real MCP tools** (Streamable HTTP, `tools/list`, `tools/call`), with separate **inbound** auth (who may call the Gateway) and **outbound** auth (how the Gateway calls Lambda).

## What we added (Phase 1 only)

| Piece | Purpose |
|--------|---------|
| `shared/src/` | Same fictional claims/CRM data as `mcp/claims` and `mcp/crm` (parity tests, no Nest changes) |
| `lambdas/claims`, `lambdas/crm` | Node 22 handlers for Gateway's flat JSON `event` + `clientContext.custom.bedrockAgentCoreToolName` |
| `terraform/` | `aws_bedrockagentcore_gateway` + 4 `aws_bedrockagentcore_gateway_target` resources (IAM, **no apply in repo**) |
| `clients/gateway-mcp-test.ts` | MCP SDK + SigV4 Streamable HTTP — discovers tools, calls two tools, compares to fixtures |
| `tests/` | Handler + domain parity tests (local, no AWS) |

**Phase 2** adds Step Functions + S3 RAG + Bedrock answer Lambdas — see [PHASE2.md](./PHASE2.md).

## AgentCore Gateway in one page

1. **Gateway** — Managed MCP **front door** (HTTPS). Clients speak MCP (`initialize`, `tools/list`, `tools/call`). Inbound auth is **`AWS_IAM`** (SigV4, `bedrock-agentcore:InvokeGateway`) — not public anonymous access.
2. **Gateway target** — One registered tool surface (here: one tool schema → one Lambda ARN). Multiple targets can point at the **same** Lambda with different tool names/schemas.
3. **How Lambda becomes MCP** — You declare `tool_schema` (name, description, JSON input properties) on the target. The Gateway advertises that schema in `tools/list`. On `tools/call`, it invokes Lambda with **arguments as the top-level `event` map** and metadata in `context.clientContext.custom` (including `bedrockAgentCoreToolName` like `targetName___getClaimStatus`).
4. **Inbound vs outbound**
   - **Inbound:** Your MCP test client signs requests with **your** IAM user/role (`InvokeGateway` on the gateway ARN).
   - **Outbound:** The Gateway uses its **execution role** (`gateway_iam_role` on each target) to `lambda:InvokeFunction` on Claims/CRM functions.
5. **Tool naming** — Names returned by `tools/list` often include a **target prefix** and `___` before the logical tool name. The Phase 1 client **does not assume** prefixes; it discovers names and matches by suffix.

## AWS console (after you deploy)

1. **Amazon Bedrock** → **AgentCore** → **Gateways** → open `insurance-ai-benchmark-gateway`.
   - Note **Gateway URL**, **Authorizer** = IAM, **Protocol** = MCP.
2. **Targets** tab — four targets (two Claims tools, two CRM tools), each with input schema and linked Lambda ARN.
3. **Lambda** → functions `insurance-ai-benchmark-claims` / `insurance-ai-benchmark-crm` → Monitor invocations when you run the MCP client.
4. **IAM** → role `insurance-ai-benchmark-gateway-role` → policies allowing `lambda:InvokeFunction` on those functions only.

## Repository layout

```
aws/benchmark/
  shared/src/          # claims + crm + workflow/RAG/gateway helpers
  lambdas/             # Gateway tool Lambdas + workflow step Lambdas
  clients/             # SigV4 MCP test + Step Functions run client
  terraform/           # Gateway, workflow, S3 corpus, Step Functions
  scripts/             # build-lambdas.mjs, export-corpus-to-s3.mjs
  tests/               # vitest (local)
```

## Prerequisites

- Node.js 22+
- Terraform **≥ 1.5** and AWS provider **≥ 6.17.0** (`aws_bedrockagentcore_gateway`, `aws_bedrockagentcore_gateway_target`)
- AWS CLI credentials (profile/SSO/env) for **your** account — never commit secrets
- Approval before **any** paid deploy (`terraform apply`, live Gateway calls)

## Local validation (no AWS spend)

From repo root:

```bash
cd aws/benchmark
npm install
npm run build:lambdas
npm test
```

Tests verify:

- Fixture parity with `InsuranceService` and `mcp/crm/crm.data.ts`
- Lambda handlers parse Gateway tool names and return the same JSON shapes as local MCP

## Deploy Phase 1 (when you approve)

```bash
cd aws/benchmark
npm install
npm run build:lambdas
npm run terraform:init
npm run terraform:plan
# Only when approved:
# terraform -chdir=terraform apply
```

Attach inbound policy to the IAM principal you use for testing (see terraform output `benchmark_invoke_gateway_policy_json`).

```bash
export AWS_REGION=us-east-1
export AGENTCORE_GATEWAY_MCP_URL="$(terraform -chdir=terraform output -raw gateway_mcp_url)"
npm run test:gateway
```

The client will:

1. Connect with **Streamable HTTP** + **SigV4** (`service = bedrock-agentcore`)
2. Use **legacy MCP negotiation** (`initialize`, not `server/discover`) — required for AgentCore Gateway
3. `tools/list` and print **actual** tool names
4. Call the discovered claim + CRM tools for `CLM-001` / `POL-001`
5. Compare payloads to `shared/src` fixtures

### Troubleshooting: `Http operation is not supported for gateway protocol type MCP`

This usually means the MCP client sent a **2026-era** request (for example `server/discover`) or a **GET** SSE operation that your Gateway does not accept for `protocol_type = MCP`. Our test client pins `versionNegotiation: { mode: 'legacy' }` and `MCP-Protocol-Version: 2025-03-26` (matching `supported_versions` in Terraform). After changing Terraform protocol versions, run `terraform apply` and retry.

Also verify `AGENTCORE_GATEWAY_MCP_URL` ends with `/mcp` (use terraform output `gateway_mcp_url`) and that your IAM principal has `bedrock-agentcore:InvokeGateway` on the gateway ARN.

## Phase 2 — claim-lookup on AWS

After Phase 1 `npm run test:gateway` succeeds, apply Terraform (Phase 2 resources ship in the same stack), export the RAG corpus, and run the workflow:

```bash
export DATABASE_URL=postgresql://...   # local DB with document_chunks
export CORPUS_BUCKET="$(terraform -chdir=terraform output -raw corpus_bucket)"
npm run export:corpus

export CLAIM_LOOKUP_STATE_MACHINE_ARN="$(terraform -chdir=terraform output -raw claim_lookup_state_machine_arn)"
npm run test:workflow
```

The run client uses the same default question as Version B for `CLM-001` / water damage. Metrics cover the **full** execution (`mcpCalls` = 2 when claim + CRM succeed, `embeddingCalls` = 1, `llmCalls` = 1).

The default Haiku id (`us.anthropic.claude-haiku-…`) uses a cross-region inference profile; the workflow Lambda IAM policy allows Bedrock in **all regions** for foundation models and inference profiles. To keep IAM regional, set `bedrock_model_id` to a non-`us.` regional model id in `terraform/variables.tf` instead.

## Destroy (after experiments)

```bash
cd aws/benchmark
npm run terraform:destroy
```

Confirm all `insurance-ai-benchmark-*` resources are gone (Gateway, targets, Lambdas, IAM roles).

## Benchmark vs Versions A/B (honest notes)

| | A (Bedrock agent) | B (LangGraph) | C Phase 1 (this) |
|--|--|--|--|
| MCP transport | Local stdio child processes | Same | **Managed Gateway HTTP + IAM** |
| Claims/CRM | In-process MCP adapter | Same | **Lambda behind Gateway** |
| Cold start | MCP process spawn | Same | **Lambda + Gateway latency** on each tool call |
| RAG / Step Functions | Yes / No | Yes / No | **Phase 2: S3 RAG + Step Functions** |

Extra latency in C is **not** “Step Functions” until Phase 2; Phase 1 overhead is mainly **network + Gateway + Lambda cold start**.

## Terraform resources (names)

- Gateway: `insurance-ai-benchmark-gateway`
- Targets: `insurance-ai-benchmark-claims-getClaimStatus`, `…-getPolicyDetails`, `…-crm-getCustomerDetails`, `…-getCustomerByPolicy`
- Lambdas: `insurance-ai-benchmark-claims`, `insurance-ai-benchmark-crm`

## References

- [Lambda function targets](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-add-target-lambda.html)
- [Gateway inbound IAM auth](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-inbound-auth.html)
- [Terraform `aws_bedrockagentcore_gateway`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/bedrockagentcore_gateway)