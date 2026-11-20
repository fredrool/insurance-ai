import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatBedrockConverse } from '@langchain/aws';
import { INTERRUPT } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { randomUUID } from 'node:crypto';

import { InsuranceMcpService } from '../../agents/bedrock/insurance-mcp.service.js';
import { BedrockEmbeddingsService } from '../../rag/embeddings/bedrock-embeddings.service.js';
import { DocumentRetrieverService } from '../../rag/retrieval/document-retriever.service.js';

import {
  buildClaimReviewGraph,
  Command,
  type CompiledClaimReviewGraph,
} from './claim-review.graph.js';
import { initialClaimReviewState } from './claim-review.state.js';
import type {
  ClaimReviewAwaitingResponse,
  ClaimReviewCompletedResponse,
  ClaimReviewFailedResponse,
  ClaimReviewRequest,
  ClaimReviewResumeRequest,
  ClaimReviewResumeResponse,
  ClaimReviewSourceSummary,
  ClaimReviewStartResponse,
  ClaimReviewStateSnapshot,
} from './claim-review.types.js';

type GraphWithState = CompiledClaimReviewGraph & {
  getState: (config: { configurable: { thread_id: string } }) => Promise<{
    values?: ClaimReviewStateSnapshot;
    next: string[];
    tasks: Array<{ interrupts?: Array<{ value?: unknown }> }>;
  }>;
  isInterrupted: (value: unknown) => boolean;
};

@Injectable()
export class ClaimReviewWorkflowService implements OnModuleInit {
  private graph?: GraphWithState;
  private checkpointer?: PostgresSaver;
  private readonly resumeInFlight = new Map<string, Promise<ClaimReviewResumeResponse>>();

  constructor(
    private readonly config: ConfigService,
    private readonly insuranceMcp: InsuranceMcpService,
    private readonly embeddings: BedrockEmbeddingsService,
    private readonly documentRetriever: DocumentRetrieverService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.checkpointer = PostgresSaver.fromConnString(
      this.config.getOrThrow<string>('DATABASE_URL'),
    );
    await this.checkpointer.setup();

    const model = new ChatBedrockConverse({
      model: this.config.getOrThrow<string>('BEDROCK_MODEL_ID'),
      region: this.config.getOrThrow<string>('BEDROCK_AWS_REGION'),
      maxTokens: 1024,
    });

    this.graph = buildClaimReviewGraph(
      {
        invokeMcpTool: (toolName, input) =>
          this.insuranceMcp.invokeTool(toolName, input),
        embeddings: this.embeddings,
        retriever: this.documentRetriever,
        model,
      },
      this.checkpointer,
    ) as GraphWithState;
  }

  private graphConfig(threadId: string) {
    return { configurable: { thread_id: threadId } };
  }

  private ensureGraph(): GraphWithState {
    if (!this.graph) {
      throw new Error('Claim review workflow not initialized');
    }
    return this.graph;
  }

  private metricsFromState(
    state: ClaimReviewStateSnapshot,
    startedAt: number,
  ) {
    return {
      durationMs: Date.now() - startedAt,
      llmCalls: state.llmCalls,
      mcpCalls: state.mcpCalls,
      inputTokens: state.inputTokens,
      outputTokens: state.outputTokens,
    };
  }

  private sourceSummaries(
    state: ClaimReviewStateSnapshot,
  ): ClaimReviewSourceSummary[] {
    return state.sources.map((source) => ({
      id: source.id,
      documentName: source.documentName,
      documentVersion: source.documentVersion,
      pageNumber: source.pageNumber,
      chunkIndex: source.chunkIndex,
      similarity: source.similarity,
    }));
  }

  private assertClaimReviewThreadId(threadId: string): void {
    if (!threadId.startsWith('claim-review:')) {
      throw new NotFoundException(`Unknown thread: ${threadId}`);
    }
  }

  private async loadSnapshot(threadId: string) {
    this.assertClaimReviewThreadId(threadId);
    const graph = this.ensureGraph();
    const snapshot = await graph.getState(this.graphConfig(threadId));
  const values = snapshot.values as ClaimReviewStateSnapshot | undefined;
    if (!values?.claimId) {
      throw new NotFoundException(`Unknown thread: ${threadId}`);
    }
    return { graph, snapshot, values };
  }

  private isAwaitingHumanApproval(
    snapshot: Awaited<ReturnType<GraphWithState['getState']>>,
  ): boolean {
    const hasPending =
      snapshot.next.length > 0 ||
      snapshot.tasks.some((task) => (task.interrupts?.length ?? 0) > 0);
    const values = snapshot.values as ClaimReviewStateSnapshot | undefined;
    return Boolean(
      hasPending &&
        values?.recommendation &&
        !values.finalStatus &&
        !values.humanDecision,
    );
  }

  async start(request: ClaimReviewRequest): Promise<ClaimReviewStartResponse> {
    const graph = this.ensureGraph();
    const threadId = `claim-review:${randomUUID()}`;
    const startedAt = Date.now();
    const input = initialClaimReviewState(
      request.claimId.trim(),
      request.question.trim(),
    );

    const result = await graph.invoke(input, this.graphConfig(threadId));
    const snapshot = await graph.getState(this.graphConfig(threadId));
    const values = snapshot.values as ClaimReviewStateSnapshot;

    if (values.finalStatus === 'failed') {
      const failed: ClaimReviewFailedResponse = {
        status: 'failed',
        claimId: values.claimId,
        threadId,
        warnings: values.warnings,
        metrics: this.metricsFromState(values, startedAt),
      };
      return failed;
    }

    const interrupted =
      graph.isInterrupted(result) ||
      snapshot.tasks.some((task) => (task.interrupts?.length ?? 0) > 0);

    if (!interrupted) {
      throw new Error('Expected human approval interrupt before completion');
    }

    const interruptValue = graph.isInterrupted(result)
      ? (result as Record<string, unknown>)[INTERRUPT] as
          | Array<{ value?: { recommendation?: string } }>
          | undefined
      : snapshot.tasks.flatMap((task) => task.interrupts ?? [])[0]?.value;

    const recommendation =
      values.recommendation ||
      (typeof interruptValue === 'object' &&
      interruptValue &&
      'recommendation' in interruptValue
        ? String((interruptValue as { recommendation: string }).recommendation)
        : '');

    const awaiting: ClaimReviewAwaitingResponse = {
      status: 'awaiting_approval',
      threadId,
      claimId: values.claimId,
      recommendation,
      sources: this.sourceSummaries(values),
      warnings: values.warnings,
      claim: values.claim,
      customer: values.customer,
      metrics: this.metricsFromState(values, startedAt),
    };
    return awaiting;
  }

  async resume(
    request: ClaimReviewResumeRequest,
  ): Promise<ClaimReviewResumeResponse> {
    const threadId = request.threadId.trim();
    const existing = this.resumeInFlight.get(threadId);
    if (existing) {
      return existing;
    }

    const work = this.resumeOnce(request);
    this.resumeInFlight.set(threadId, work);
    try {
      return await work;
    } finally {
      this.resumeInFlight.delete(threadId);
    }
  }

  private async resumeOnce(
    request: ClaimReviewResumeRequest,
  ): Promise<ClaimReviewResumeResponse> {
    const threadId = request.threadId.trim();
    const { graph, snapshot, values } = await this.loadSnapshot(threadId);

    if (values.finalStatus === 'approved' || values.finalStatus === 'rejected') {
      throw new ConflictException(
        `Thread ${threadId} has already completed with status ${values.finalStatus}`,
      );
    }

    if (!this.isAwaitingHumanApproval(snapshot)) {
      throw new ConflictException(
        `Thread ${threadId} is not awaiting human approval`,
      );
    }

    const startedAt = Date.now();
    const result = await graph.invoke(
      new Command({
        resume: {
          approved: request.approved,
          comment: request.comment?.trim() || undefined,
        },
      }),
      this.graphConfig(threadId),
    );

    if (graph.isInterrupted(result)) {
      throw new ConflictException(
        `Thread ${threadId} is still interrupted after resume`,
      );
    }

    const finalSnapshot = await graph.getState(this.graphConfig(threadId));
    const finalValues = finalSnapshot.values as ClaimReviewStateSnapshot;
    const decision =
      finalValues.finalStatus === 'approved' ? 'approved' : 'rejected';

    if (finalValues.finalStatus !== 'approved' && finalValues.finalStatus !== 'rejected') {
      throw new Error('Claim review did not reach a terminal simulated decision');
    }

    const response: ClaimReviewCompletedResponse = {
      status: 'completed',
      claimId: finalValues.claimId,
      decision,
      comment: finalValues.humanDecision?.comment,
      simulated: true,
      finalStatus: finalValues.finalStatus,
      recommendation: finalValues.recommendation,
      warnings: finalValues.warnings,
      metrics: this.metricsFromState(finalValues, startedAt),
    };
    return response;
  }
}