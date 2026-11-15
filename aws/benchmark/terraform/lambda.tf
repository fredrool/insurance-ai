data "archive_file" "claims_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../dist/lambdas/claims"
  output_path = "${path.module}/../dist/lambdas/claims.zip"
}

data "archive_file" "crm_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../dist/lambdas/crm"
  output_path = "${path.module}/../dist/lambdas/crm.zip"
}

resource "aws_lambda_function" "claims" {
  function_name = "${var.name_prefix}-claims"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  timeout       = 10
  memory_size   = 256

  filename         = data.archive_file.claims_lambda.output_path
  source_code_hash = data.archive_file.claims_lambda.output_base64sha256

  tags = var.tags
}

resource "aws_lambda_function" "crm" {
  function_name = "${var.name_prefix}-crm"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  timeout       = 10
  memory_size   = 256

  filename         = data.archive_file.crm_lambda.output_path
  source_code_hash = data.archive_file.crm_lambda.output_base64sha256

  tags = var.tags
}

resource "aws_lambda_permission" "claims_gateway" {
  statement_id  = "AllowExecutionFromAgentCoreGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.claims.function_name
  principal     = "bedrock-agentcore.amazonaws.com"
  source_arn    = aws_bedrockagentcore_gateway.main.gateway_arn
}

resource "aws_lambda_permission" "crm_gateway" {
  statement_id  = "AllowExecutionFromAgentCoreGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.crm.function_name
  principal     = "bedrock-agentcore.amazonaws.com"
  source_arn    = aws_bedrockagentcore_gateway.main.gateway_arn
}