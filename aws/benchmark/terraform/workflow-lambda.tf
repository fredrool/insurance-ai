data "archive_file" "workflow_load_claim" {
  type        = "zip"
  source_dir  = "${path.module}/../dist/lambdas/workflow-load-claim"
  output_path = "${path.module}/../dist/lambdas/workflow-load-claim.zip"
}

data "archive_file" "workflow_load_customer" {
  type        = "zip"
  source_dir  = "${path.module}/../dist/lambdas/workflow-load-customer"
  output_path = "${path.module}/../dist/lambdas/workflow-load-customer.zip"
}

data "archive_file" "workflow_retrieve" {
  type        = "zip"
  source_dir  = "${path.module}/../dist/lambdas/workflow-retrieve"
  output_path = "${path.module}/../dist/lambdas/workflow-retrieve.zip"
}

data "archive_file" "workflow_generate_answer" {
  type        = "zip"
  source_dir  = "${path.module}/../dist/lambdas/workflow-generate-answer"
  output_path = "${path.module}/../dist/lambdas/workflow-generate-answer.zip"
}

locals {
  workflow_lambda_env = {
    GATEWAY_MCP_URL    = "${local.gateway_base_url}/mcp"
    BEDROCK_AWS_REGION = var.aws_region
    BEDROCK_MODEL_ID   = var.bedrock_model_id
    CORPUS_BUCKET      = aws_s3_bucket.corpus.id
    CORPUS_OBJECT_KEY  = var.corpus_object_key
  }
}

resource "aws_lambda_function" "workflow_load_claim" {
  function_name = "${var.name_prefix}-wf-load-claim"
  role          = aws_iam_role.workflow_lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  timeout       = 60
  memory_size   = 512

  filename         = data.archive_file.workflow_load_claim.output_path
  source_code_hash = data.archive_file.workflow_load_claim.output_base64sha256

  environment {
    variables = local.workflow_lambda_env
  }

  tags = var.tags
}

resource "aws_lambda_function" "workflow_load_customer" {
  function_name = "${var.name_prefix}-wf-load-customer"
  role          = aws_iam_role.workflow_lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  timeout       = 60
  memory_size   = 512

  filename         = data.archive_file.workflow_load_customer.output_path
  source_code_hash = data.archive_file.workflow_load_customer.output_base64sha256

  environment {
    variables = local.workflow_lambda_env
  }

  tags = var.tags
}

resource "aws_lambda_function" "workflow_retrieve" {
  function_name = "${var.name_prefix}-wf-retrieve"
  role          = aws_iam_role.workflow_lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  timeout       = 120
  memory_size   = 1024

  filename         = data.archive_file.workflow_retrieve.output_path
  source_code_hash = data.archive_file.workflow_retrieve.output_base64sha256

  environment {
    variables = local.workflow_lambda_env
  }

  tags = var.tags
}

resource "aws_lambda_function" "workflow_generate_answer" {
  function_name = "${var.name_prefix}-wf-generate-answer"
  role          = aws_iam_role.workflow_lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  timeout       = 120
  memory_size   = 512

  filename         = data.archive_file.workflow_generate_answer.output_path
  source_code_hash = data.archive_file.workflow_generate_answer.output_base64sha256

  environment {
    variables = local.workflow_lambda_env
  }

  tags = var.tags
}