import type { AriaLogger, ProviderAdapter, ProviderPlanRequest, ProviderSettings } from '@aria/types';

import { requireEnv } from '../env.js';
import { parseDecision } from '../json.js';
import { buildSystemPrompt, buildUserPrompt } from '../prompt.js';
import { postJson } from '../http.js';

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
}

export class AnthropicProvider implements ProviderAdapter {
  public readonly name = 'anthropic';

  public constructor(
    private readonly settings: ProviderSettings,
    private readonly logger: AriaLogger
  ) {}

  public async plan(request: ProviderPlanRequest) {
    const apiKey = requireEnv(this.settings.apiKeyEnv ?? 'ANTHROPIC_API_KEY', 'anthropic');
    const response = await postJson<AnthropicResponse>(
      this.settings.baseUrl ?? 'https://api.anthropic.com/v1/messages',
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: {
          model: this.settings.model,
          max_tokens: 600,
          system: buildSystemPrompt(),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: buildUserPrompt(request) },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: request.screenshot.base64
                  }
                }
              ]
            }
          ]
        }
      },
      this.logger
    );

    const text = response.content?.find((item) => item.type === 'text')?.text ?? '';
    return parseDecision(text, this.name);
  }
}
