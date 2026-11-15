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
    Version     = "C-phase1"
    Environment = "benchmark"
  }
}