data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_iam_policy_document" "gateway_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["bedrock-agentcore.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "gateway" {
  name               = "${var.name_prefix}-gateway-role"
  assume_role_policy = data.aws_iam_policy_document.gateway_assume.json
  description        = "AgentCore Gateway execution role (outbound Lambda invoke)"
}

data "aws_iam_policy_document" "gateway_lambda_invoke" {
  statement {
    sid    = "InvokeClaimsCrmLambdas"
    effect = "Allow"
    actions = [
      "lambda:InvokeFunction",
    ]
    resources = [
      aws_lambda_function.claims.arn,
      aws_lambda_function.crm.arn,
    ]
  }
}

resource "aws_iam_role_policy" "gateway_lambda_invoke" {
  name   = "${var.name_prefix}-gateway-lambda-invoke"
  role   = aws_iam_role.gateway.id
  policy = data.aws_iam_policy_document.gateway_lambda_invoke.json
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.name_prefix}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "benchmark_invoke_gateway" {
  statement {
    sid    = "InvokeAgentCoreGateway"
    effect = "Allow"
    actions = [
      "bedrock-agentcore:InvokeGateway",
    ]
    resources = [
      "arn:aws:bedrock-agentcore:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:gateway/${aws_bedrockagentcore_gateway.main.gateway_id}",
    ]
  }
}

output "benchmark_invoke_gateway_policy_json" {
  description = "Attach this statement to the IAM user/role that runs the MCP test client (inbound IAM auth)."
  value       = data.aws_iam_policy_document.benchmark_invoke_gateway.json
}