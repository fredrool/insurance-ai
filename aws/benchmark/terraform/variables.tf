variable "aws_region" {
  description = "AWS region for Version C benchmark resources."
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix for all benchmark resource names."
  type        = string
  default     = "insurance-ai-benchmark"
}

variable "tags" {
  description = "Tags applied to billable resources."
  type        = map(string)
  default = {
    Project     = "insurance-ai"
    Version     = "C-phase2"
    Environment = "benchmark"
  }
}

variable "bedrock_model_id" {
  description = "Bedrock Converse model for the workflow generate-answer step."
  type        = string
  default     = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}

variable "corpus_object_key" {
  description = "S3 object key for exported document_chunks JSON."
  type        = string
  default     = "corpus/document-chunks.json"
}