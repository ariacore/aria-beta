import type { ProviderAdapter, ProviderPlanRequest } from '@ariacore/types';

export class GroqProvider implements ProviderAdapter {
  public readonly name = 'groq';

  public async plan(_request: ProviderPlanRequest): Promise<never> {
    throw new Error('Groq is configured as text-only in ARIA V1 and cannot drive vision computer-use actions.');
  }
}
