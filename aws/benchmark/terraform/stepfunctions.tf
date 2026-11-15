resource "aws_sfn_state_machine" "claim_lookup" {
  name     = "${var.name_prefix}-claim-lookup"
  role_arn = aws_iam_role.sfn.arn
  type     = "STANDARD"

  definition = templatefile("${path.module}/claim-lookup.asl.json", {
    load_claim_arn      = aws_lambda_function.workflow_load_claim.arn
    load_customer_arn   = aws_lambda_function.workflow_load_customer.arn
    retrieve_arn        = aws_lambda_function.workflow_retrieve.arn
    generate_answer_arn = aws_lambda_function.workflow_generate_answer.arn
  })

  tags = var.tags
}