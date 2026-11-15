resource "aws_bedrockagentcore_gateway" "main" {
  name            = "${var.name_prefix}-gateway"
  description     = "Version C benchmark: fictional claims + CRM as MCP tools"
  role_arn        = aws_iam_role.gateway.arn
  authorizer_type = "AWS_IAM"
  protocol_type   = "MCP"

  protocol_configuration {
    mcp {
      supported_versions = ["2025-03-26", "2025-06-18", "2025-11-25"]
    }
  }

  tags = var.tags
}

resource "aws_bedrockagentcore_gateway_target" "claims_get_claim_status" {
  name               = "${var.name_prefix}-claims-getClaimStatus"
  gateway_identifier = aws_bedrockagentcore_gateway.main.gateway_id
  description        = "Retrieve claim status (fictional ABC Assurances)"

  credential_provider_configuration {
    gateway_iam_role {}
  }

  target_configuration {
    mcp {
      lambda {
        lambda_arn = aws_lambda_function.claims.arn

        tool_schema {
          inline_payload {
            name        = "getClaimStatus"
            description = "Retrieve the status of an insurance claim."

            input_schema {
              type        = "object"
              description = "Claim lookup"

              property {
                name        = "claimId"
                type        = "string"
                description = "Claim ID, e.g. CLM-001"
                required    = true
              }
            }
          }
        }
      }
    }
  }
}

resource "aws_bedrockagentcore_gateway_target" "claims_get_policy_details" {
  name               = "${var.name_prefix}-claims-getPolicyDetails"
  gateway_identifier = aws_bedrockagentcore_gateway.main.gateway_id
  description        = "Retrieve policy details"

  credential_provider_configuration {
    gateway_iam_role {}
  }

  target_configuration {
    mcp {
      lambda {
        lambda_arn = aws_lambda_function.claims.arn

        tool_schema {
          inline_payload {
            name        = "getPolicyDetails"
            description = "Retrieve details of an insurance policy."

            input_schema {
              type        = "object"
              description = "Policy lookup"

              property {
                name        = "policyId"
                type        = "string"
                description = "Policy ID, e.g. POL-001"
                required    = true
              }
            }
          }
        }
      }
    }
  }
}

resource "aws_bedrockagentcore_gateway_target" "crm_get_customer_details" {
  name               = "${var.name_prefix}-crm-getCustomerDetails"
  gateway_identifier = aws_bedrockagentcore_gateway.main.gateway_id
  description        = "Retrieve fictional CRM customer profile"

  credential_provider_configuration {
    gateway_iam_role {}
  }

  target_configuration {
    mcp {
      lambda {
        lambda_arn = aws_lambda_function.crm.arn

        tool_schema {
          inline_payload {
            name        = "getCustomerDetails"
            description = "Retrieve fictional CRM profile and linked policy IDs."

            input_schema {
              type        = "object"
              description = "Customer lookup"

              property {
                name        = "customerId"
                type        = "string"
                description = "Customer ID, e.g. CUS-1001"
                required    = true
              }
            }
          }
        }
      }
    }
  }
}

resource "aws_bedrockagentcore_gateway_target" "crm_get_customer_by_policy" {
  name               = "${var.name_prefix}-crm-getCustomerByPolicy"
  gateway_identifier = aws_bedrockagentcore_gateway.main.gateway_id
  description        = "Look up CRM customer by policy ID"

  credential_provider_configuration {
    gateway_iam_role {}
  }

  target_configuration {
    mcp {
      lambda {
        lambda_arn = aws_lambda_function.crm.arn

        tool_schema {
          inline_payload {
            name        = "getCustomerByPolicy"
            description = "Look up the fictional CRM customer linked to a policy ID."

            input_schema {
              type        = "object"
              description = "Policy-to-customer lookup"

              property {
                name        = "policyId"
                type        = "string"
                description = "Policy ID shared with Claims, e.g. POL-001"
                required    = true
              }
            }
          }
        }
      }
    }
  }
}