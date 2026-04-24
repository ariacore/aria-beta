import type { AriaLogger, MetaCognitionConfig, ProviderAdapter, ProviderDecision, ProviderPlanRequest } from '@ariacore/types';

export class MetaCognitionService {
  private escalationsUsed = 0;

  public constructor(
    private readonly config: MetaCognitionConfig,
    private readonly helperProvider: ProviderAdapter | undefined,
    private readonly logger: AriaLogger
  ) {}

  public async maybeEscalate(request: ProviderPlanRequest, primaryDecision: ProviderDecision): Promise<ProviderDecision> {
    if (!this.config.enabled || !this.helperProvider) {
      return primaryDecision;
    }

    if (primaryDecision.confidence >= this.config.escalationConfidenceThreshold) {
      return primaryDecision;
    }

    if (this.escalationsUsed >= this.config.maxEscalationsPerJob) {
      return primaryDecision;
    }

    this.escalationsUsed += 1;
    this.logger.warn('Escalating decision to helper provider.', {
      primaryProvider: primaryDecision.provider,
      helperProvider: this.helperProvider.name,
      confidence: primaryDecision.confidence
    });

    const helperDecision = await this.helperProvider.plan({
      ...request,
      goal: `${request.goal}\n\nThe previous model was uncertain. Provide the strongest next step you can justify from the screenshot.`
    });

    return helperDecision.confidence > primaryDecision.confidence ? helperDecision : primaryDecision;
  }
}

