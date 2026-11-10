import {
    BedrockRuntimeClient,
    InvokeModelCommand,
  } from "@aws-sdk/client-bedrock-runtime";
  
  const client = new BedrockRuntimeClient({
    region: process.env.BEDROCK_AWS_REGION ?? "us-east-1",
  });
  
  export async function generateEmbedding(text) {
    const response = await client.send(
      new InvokeModelCommand({
        modelId: "amazon.titan-embed-text-v2:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          inputText: text,
          dimensions: 512,
          normalize: true,
        }),
      }),
    );
  
    const result = JSON.parse(
      new TextDecoder().decode(response.body),
    );
  
    return result.embedding;
  }