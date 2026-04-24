import { describe, expect, it } from 'vitest';

import { createLogger } from '@aria/logger';
import { MetaCognitionService } from '@aria/agent';
import type { ProviderAdapter, ProviderPlanRequest } from '@aria/types';

class StaticProvider implements ProviderAdapter {
  public readonly name = 'mock';

  public constructor(private readonly confidence: number) {}

  public async plan(_request: ProviderPlanRequest) {
    return {
      provider: 'mock' as const,
      thought: 'helper decision',
      confidence: this.confidence,
      action: {
        tool: 'complete' as const,
        input: { summary: 'done' }
      }
    };
  }
}

describe('meta-cognition', () => {
  it('uses the helper provider when primary confidence is too low', async () => {
    const service = new MetaCognitionService(
      {
        enabled: true,
        helperProvider: 'mock',
        escalationConfidenceThreshold: 0.5,
        maxEscalationsPerJob: 1
      },
      new StaticProvider(0.9),
      createLogger()
    );

    const request: ProviderPlanRequest = {
      goal: 'finish something',
      screenshot: {
        id: 'shot-1',
        mimeType: 'image/png',
        base64: 'AAAA',
        width: 10,
        height: 10,
        capturedAt: new Date().toISOString()
      },
      history: [],
      availableActions: ['complete']
    };

    const decision = await service.maybeEscalate(request, {
      provider: 'mock',
      thought: 'unsure',
      confidence: 0.2,
      action: {
        tool: 'computer',
        input: { action: 'wait', duration: 1 }
      }
    });

    expect(decision.confidence).toBe(0.9);
    expect(decision.action.tool).toBe('complete');
  });

  it('returns primary decision if confidence is above threshold', async () => {
    const service = new MetaCognitionService(
      { enabled: true, helperProvider: 'mock', escalationConfidenceThreshold: 0.5, maxEscalationsPerJob: 1 },
      new StaticProvider(0.9),
      createLogger()
    );

    const primaryDecision = {
      provider: 'local-qwen' as const,
      thought: 'confident',
      confidence: 0.8,
      action: { tool: 'computer' as const, input: { action: 'wait' as const, duration: 1 } }
    };

    const request = { goal: 'finish', screenshot: {} as any, history: [], availableActions: [] };
    const decision = await service.maybeEscalate(request, primaryDecision);
    
    expect(decision.provider).toBe('local-qwen');
    expect(decision.confidence).toBe(0.8);
  });

  it('stops escalating after max escalations', async () => {
    const service = new MetaCognitionService(
      { enabled: true, helperProvider: 'mock', escalationConfidenceThreshold: 0.8, maxEscalationsPerJob: 1 },
      new StaticProvider(0.9),
      createLogger()
    );

    const request = { goal: 'finish', screenshot: {} as any, history: [], availableActions: [] };
    const weakDecision = {
      provider: 'local-qwen' as const,
      thought: 'unsure',
      confidence: 0.2,
      action: { tool: 'computer' as const, input: { action: 'wait' as const, duration: 1 } }
    };

    // First escalation works
    const decision1 = await service.maybeEscalate(request, weakDecision);
    expect(decision1.confidence).toBe(0.9);

    // Second escalation hits the limit and returns the weak decision
    const decision2 = await service.maybeEscalate(request, weakDecision);
    expect(decision2.confidence).toBe(0.2);
  });

  it('returns primary decision if helper provider confidence is lower', async () => {
    const service = new MetaCognitionService(
      { enabled: true, helperProvider: 'mock', escalationConfidenceThreshold: 0.8, maxEscalationsPerJob: 1 },
      new StaticProvider(0.1), // Helper is even more confused
      createLogger()
    );

    const request = { goal: 'finish', screenshot: {} as any, history: [], availableActions: [] };
    const weakDecision = {
      provider: 'local-qwen' as const,
      thought: 'unsure',
      confidence: 0.3,
      action: { tool: 'computer' as const, input: { action: 'wait' as const, duration: 1 } }
    };

    const decision = await service.maybeEscalate(request, weakDecision);
    expect(decision.provider).toBe('local-qwen');
    expect(decision.confidence).toBe(0.3);
  });
});

