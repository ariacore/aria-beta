import type { AriaLogger, ProviderAdapter, ProviderPlanRequest, ProviderSettings } from '@aria/types';

import { parseDecision } from '../json.js';
import { buildSystemPrompt, buildUserPrompt, decisionSchema } from '../prompt.js';
import { postJson } from '../http.js';

interface LmStudioResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export class LmStudioProvider implements ProviderAdapter {
  public readonly name = 'lmstudio';

  public constructor(
    private readonly settings: ProviderSettings,
    private readonly logger: AriaLogger
  ) {}

  public async plan(request: ProviderPlanRequest) {
    const response = await postJson<LmStudioResponse>(
      this.settings.baseUrl ?? 'http://127.0.0.1:1234/v1/chat/completions',
      {
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

    return parseDecision(response.choices?.[0]?.message?.content ?? '', this.name);
  }
}

