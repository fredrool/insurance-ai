/**
 * Phase 2 — run the Step Functions claim-lookup workflow (same benchmark as Version B).
 *
 * Requires:
 *   CLAIM_LOOKUP_STATE_MACHINE_ARN  (terraform output claim_lookup_state_machine_arn)
 *   AWS_REGION                      default us-east-1
 *
 * IAM: states:StartExecution + DescribeExecution on the state machine (see terraform output).
 */
import {
  DescribeExecutionCommand,
  SFNClient,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn';

import {
  BENCHMARK_DEFAULT_QUESTION,
  initialWorkflowState,
  toWorkflowResponse,
} from '../shared/src/workflow-state.js';

const arn = process.env.CLAIM_LOOKUP_STATE_MACHINE_ARN;
const region = process.env.AWS_REGION ?? 'us-east-1';
const claimId = process.env.CLAIM_ID ?? 'CLM-001';
const question = process.env.WORKFLOW_QUESTION ?? BENCHMARK_DEFAULT_QUESTION;

if (!arn) {
  console.error('CLAIM_LOOKUP_STATE_MACHINE_ARN is required');
  process.exit(1);
}

const input = initialWorkflowState(claimId, question);
const sfn = new SFNClient({ region });
const pollIntervalMs = Number(process.env.WORKFLOW_POLL_MS ?? 2000);
const timeoutMs = Number(process.env.WORKFLOW_TIMEOUT_MS ?? 300_000);

const started = Date.now();
const start = await sfn.send(
  new StartExecutionCommand({
    stateMachineArn: arn,
    input: JSON.stringify(input),
  }),
);

const executionArn = start.executionArn;
if (!executionArn) {
  console.error('StartExecution did not return executionArn');
  process.exit(1);
}

let output: string | undefined;
while (Date.now() - started < timeoutMs) {
  const execution = await sfn.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  const status = execution.status;
  if (status === 'RUNNING') {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    continue;
  }
  if (status === 'SUCCEEDED') {
    output = execution.output;
    break;
  }
  console.error(
    'Execution failed:',
    status,
    execution.error,
    execution.cause,
  );
  process.exit(1);
}

if (output === undefined) {
  console.error(`Timed out after ${timeoutMs}ms (executionArn=${executionArn})`);
  process.exit(1);
}

const finalState = JSON.parse(output ?? '{}');
const response = toWorkflowResponse(finalState);
response.metrics.durationMs = Math.max(0, Date.now() - started);

console.log(JSON.stringify(response, null, 2));