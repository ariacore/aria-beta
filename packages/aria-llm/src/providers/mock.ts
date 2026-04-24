import type { ProviderAdapter, ProviderDecision, ProviderPlanRequest } from '@aria/types';

export class MockProvider implements ProviderAdapter {
  public readonly name = 'mock';

  public constructor(private readonly scriptedActions: ProviderDecision[] = []) {}

  public async plan(request: ProviderPlanRequest): Promise<ProviderDecision> {
    const scripted = this.scriptedActions.at(request.history.length);
    if (scripted) {
      return scripted;
    }

    if (request.history.length >= 2) {
      return {
        provider: 'mock',
        thought: 'The scripted mock provider considers the task complete.',
        confidence: 0.95,
        action: {
          tool: 'complete',
          input: {
            summary: `Mock run completed for goal: ${request.goal}`
          }
        }
      };
    }

    return {
      provider: 'mock',
      thought: 'Take a passive screenshot-first step in the mock environment.',
      confidence: 0.9,
      action: {
        tool: 'computer',
        input:
          request.history.length === 0
            ? { action: 'screenshot' }
            : {
                action: 'wait',
                duration: 1
              }
      }
    };
  }
}
