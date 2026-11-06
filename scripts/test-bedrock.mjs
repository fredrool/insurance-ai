import { ChatBedrockConverse } from "@langchain/aws";

const model = new ChatBedrockConverse({
  model: process.env.BEDROCK_MODEL_ID,
  region: process.env.BEDROCK_AWS_REGION,
  maxTokens: 256,
});

const response = await model.invoke(
  "Explique en une phrase ce qu'est une franchise en assurance."
);

console.log("Bedrock response:", response.content);
console.log("Token usage:", response.usage_metadata);