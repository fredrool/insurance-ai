resource "aws_iam_role" "workflow_lambda" {
  name               = "${var.name_prefix}-workflow-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "workflow_lambda_basic" {
  role       = aws_iam_role.workflow_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "workflow_lambda" {
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

  statement {
    sid    = "BedrockModelAccess"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
      "bedrock:Converse",
      "bedrock:ConverseStream",
    ]
    # us.* profiles may invoke foundation models outside var.aws_region (cross-region routing).
    resources = [
      "arn:aws:bedrock:*::foundation-model/*",
      "arn:aws:bedrock:*:${data.aws_caller_identity.current.account_id}:inference-profile/*",
      "arn:aws:bedrock:*:${data.aws_caller_identity.current.account_id}:application-inference-profile/*",
    ]
  }

  statement {
    sid    = "ReadCorpusObject"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.corpus.arn,
      "${aws_s3_bucket.corpus.arn}/*",
    ]
  }
}

resource "aws_iam_role_policy" "workflow_lambda" {
  name   = "${var.name_prefix}-workflow-lambda"
  role   = aws_iam_role.workflow_lambda.id
  policy = data.aws_iam_policy_document.workflow_lambda.json
}

data "aws_iam_policy_document" "sfn_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "sfn" {
  name               = "${var.name_prefix}-sfn-role"
  assume_role_policy = data.aws_iam_policy_document.sfn_assume.json
}

data "aws_iam_policy_document" "sfn_invoke_workflow" {
  statement {
    sid    = "InvokeWorkflowLambdas"
    effect = "Allow"
    actions = [
      "lambda:InvokeFunction",
    ]
    resources = [
      aws_lambda_function.workflow_load_claim.arn,
      aws_lambda_function.workflow_load_customer.arn,
      aws_lambda_function.workflow_retrieve.arn,
      aws_lambda_function.workflow_generate_answer.arn,
    ]
  }
}

resource "aws_iam_role_policy" "sfn_invoke_workflow" {
  name   = "${var.name_prefix}-sfn-invoke-workflow"
  role   = aws_iam_role.sfn.id
  policy = data.aws_iam_policy_document.sfn_invoke_workflow.json
}

resource "aws_lambda_permission" "sfn_load_claim" {
  statement_id  = "AllowStepFunctionsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.workflow_load_claim.function_name
  principal     = "states.amazonaws.com"
  source_arn    = aws_sfn_state_machine.claim_lookup.arn
}

resource "aws_lambda_permission" "sfn_load_customer" {
  statement_id  = "AllowStepFunctionsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.workflow_load_customer.function_name
  principal     = "states.amazonaws.com"
  source_arn    = aws_sfn_state_machine.claim_lookup.arn
}

resource "aws_lambda_permission" "sfn_retrieve" {
  statement_id  = "AllowStepFunctionsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.workflow_retrieve.function_name
  principal     = "states.amazonaws.com"
  source_arn    = aws_sfn_state_machine.claim_lookup.arn
}

resource "aws_lambda_permission" "sfn_generate_answer" {
  statement_id  = "AllowStepFunctionsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.workflow_generate_answer.function_name
  principal     = "states.amazonaws.com"
  source_arn    = aws_sfn_state_machine.claim_lookup.arn
}

data "aws_iam_policy_document" "benchmark_start_workflow" {
  statement {
    sid    = "StartClaimLookupWorkflow"
    effect = "Allow"
    actions = [
      "states:StartExecution",
      "states:DescribeExecution",
    ]
    resources = [
      aws_sfn_state_machine.claim_lookup.arn,
      "${aws_sfn_state_machine.claim_lookup.arn}:*",
    ]
  }
}

output "benchmark_start_workflow_policy_json" {
  description = "Attach to the IAM principal that runs the Phase 2 workflow client."
  value       = data.aws_iam_policy_document.benchmark_start_workflow.json
}