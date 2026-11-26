import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';

import { ClaimMonitoringAgent } from './claim-monitoring.agent.js';
import { CLAIM_MONITORING_SYSTEM_PROMPT } from './claim-monitoring.prompt.js';
import type { MonitoringClaimInput } from './claim-monitoring.types.js';

const mockInvoke = vi.hoisted(() => vi.fn());
const createAgentMock = vi.hoisted(() =>
  vi.fn(function createAgent() {
    return { invoke: mockInvoke };
  }),
);
const initCount = vi.hoisted(() => ({ value: 0 }));

vi.mock('langchain', async (importOriginal) => {
  const original = await importOriginal<typeof import('langchain')>();
  return {
    ...original,
    createAgent: vi.fn(function createAgent(config: unknown) {
      initCount.value += 1;
      createAgentMock(config);
      return { invoke: mockInvoke };
    }),
  };
});

vi.mock('@langchain/aws', () => ({
  ChatBedrockConverse: vi.fn(function ChatBedrockConverse() {
    return {};
  }),
}));

const sampleClaim: MonitoringClaimInput = {
  claimId: 'CLM-100',
  policyId: 'POL-001',
  amount: 25_000,
  currency: 'CAD',
  incidentDate: '2026-11-01',
  submittedAt: '2026-11-10',
  description: 'Minor water damage from a burst pipe',
};

describe('ClaimMonitoringAgent', () => {
  let agent: ClaimMonitoringAgent;

  beforeEach(async () => {
    mockInvoke.mockReset();
    createAgentMock.mockClear();

    mockInvoke.mockResolvedValue({
      structuredResponse: {
        claimId: 'CLM-100',
        compliant: true,
        violations: [],
        summary: 'Claim appears compliant.',
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaimMonitoringAgent,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'BEDROCK_MODEL_ID') return 'test-model';
              if (key === 'BEDROCK_AWS_REGION') return 'us-east-1';
              throw new Error(`Unknown key ${key}`);
            },
          },
        },
      ],
    }).compile();

    agent = module.get(ClaimMonitoringAgent);
    agent.onModuleInit();
  });

  it('initializes createAgent only once per service instance', () => {
    expect(createAgentMock).toHaveBeenCalledOnce();
    expect(agent.getInitializedAgent()).toBeDefined();
    const config = createAgentMock.mock.calls[0]?.[0] as {
      systemPrompt: string;
      tools: unknown[];
    };
    expect(config.systemPrompt).toBe(CLAIM_MONITORING_SYSTEM_PROMPT);
    expect(config.tools).toEqual([]);
  });

  it('invokes with a fresh thread_id for each claim', async () => {
    await agent.onClaim(sampleClaim);
    await agent.onClaim({ ...sampleClaim, claimId: 'CLM-101' });

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    const firstThread =
      mockInvoke.mock.calls[0]?.[1]?.configurable?.thread_id;
    const secondThread =
      mockInvoke.mock.calls[1]?.[1]?.configurable?.thread_id;
    expect(firstThread).toMatch(/^monitoring:/);
    expect(secondThread).toMatch(/^monitoring:/);
    expect(firstThread).not.toBe(secondThread);
  });

  it('does not pass prior claim messages between invocations', async () => {
    await agent.onClaim(sampleClaim);
    const firstMessages = mockInvoke.mock.calls[0]?.[0]?.messages;
    expect(firstMessages).toHaveLength(1);
    expect(String(firstMessages[0]?.content)).toContain('CLM-100');
  });

  it('returns parsed structured assessment', async () => {
    const result = await agent.onClaim(sampleClaim);
    expect(result.claimId).toBe('CLM-100');
    expect(result.compliant).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('falls back to parsing JSON from the last assistant message', async () => {
    mockInvoke.mockResolvedValueOnce({
      messages: [
        {
          role: 'assistant',
          content: JSON.stringify({
            claimId: 'CLM-100',
            compliant: false,
            violations: [
              {
                ruleId: 'HIGH_CLAIM_AMOUNT',
                explanation: 'Amount exceeds CAD 100000.',
                requiresHumanReview: true,
              },
            ],
            summary: 'High amount requires review.',
          }),
        },
      ],
    });

    const result = await agent.onClaim({
      ...sampleClaim,
      amount: 150_000,
    });
    expect(result.compliant).toBe(false);
    expect(result.violations[0]?.ruleId).toBe('HIGH_CLAIM_AMOUNT');
  });
});