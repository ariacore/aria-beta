import type { AriaLogger, ProviderAdapter, ProviderPlanRequest, ProviderSettings } from '@aria/types';

import { requireEnv } from '../env.js';
import { parseDecision } from '../json.js';
import { buildSystemPrompt, buildUserPrompt, decisionSchema } from '../prompt.js';
import { postJson } from '../http.js';

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export class OpenRouterProvider implements ProviderAdapter {
  public readonly name = 'openrouter';

  public constructor(
    private readonly settings: ProviderSettings,
    private readonly logger: AriaLogger
  ) {}

  public async plan(request: ProviderPlanRequest) {
    const apiKey = requireEnv(this.settings.apiKeyEnv ?? 'OPENROUTER_API_KEY', 'openrouter');
    const response = await postJson<OpenRouterResponse>(
      this.settings.baseUrl ?? 'https://openrouter.ai/api/v1/chat/completions',
      {
        headers: {
          authorization: `Bearer ${apiKey}`
        },
        body: {
          model: this.settings.model,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            {
              role: 'user',
              content: [
                { type: 'text', text: buildUserPrompt(request) },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${request.screenshot.base64}`
                  }
                }
              ]
            }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'aria_decision',
              strict: true,
              schema: decisionSchema
            }
          }
        }
      },
      this.logger
    );

    const text = response.choices?.[0]?.message?.content ?? '';
    return parseDecision(text, this.name);
  }
}
