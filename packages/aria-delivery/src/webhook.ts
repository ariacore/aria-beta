import type { AriaConfig, JobRecord, AgentStepRecord } from '@ariacore/types';

export class WebhookTransport {
  public constructor(private readonly config: AriaConfig) {}

  public isEnabled(): boolean {
    return this.config.delivery.webhook.enabled;
  }

  public async sendPayload(job: JobRecord, steps: AgentStepRecord[]): Promise<void> {
    if (!this.isEnabled()) return;

    const url = process.env[this.config.delivery.webhook.urlEnv];
    const secret = process.env[this.config.delivery.webhook.secretEnv];

    if (!url) {
      throw new Error(
        `Webhook delivery enabled but env var ${this.config.delivery.webhook.urlEnv} is missing.`
      );
    }

    const payload = {
      job,
      steps
    };

    const headers: Record<string, string> = {
      'content-type': 'application/json'
    };

    if (secret) {
      headers['authorization'] = `Bearer ${secret}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed with status ${response.status}`);
    }
  }
}
