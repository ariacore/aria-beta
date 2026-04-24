import type { AriaLogger, ProviderAdapter, ProviderPlanRequest, ProviderSettings } from '@aria/types';

import { requireEnv } from '../env.js';
import { parseDecision } from '../json.js';
import { buildSystemPrompt, buildUserPrompt, decisionSchema } from '../prompt.js';
import { postJson } from '../http.js';

interface OpenAiResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{ text?: string }>;
  }>;
}

export class OpenAiProvider implements ProviderAdapter {
  public readonly name = 'openai';

  public constructor(
    private readonly settings: ProviderSettings,
    private readonly logger: AriaLogger
  ) {}

  public async plan(request: ProviderPlanRequest) {
    const apiKey = requireEnv(this.settings.apiKeyEnv ?? 'OPENAI_API_KEY', 'openai');
    const response = await postJson<OpenAiResponse>(
      this.settings.baseUrl ?? 'https://api.openai.com/v1/responses',
      {
        headers: {
          authorization: `Bearer ${apiKey}`
        },
        body: {
          model: this.settings.model,
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: buildSystemPrompt() }]
            },
            {
              role: 'user',
              content: [
                { type: 'input_text', text: buildUserPrompt(request) },
                {
                  type: 'input_image',
                  image_url: `data:image/png;base64,${request.screenshot.base64}`
                }
              ]
            }
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'aria_decision',
              schema: decisionSchema,
              strict: true
            }
          }
        }
      },
      this.logger
    );

    const text =
      response.output_text ??
      response.output?.flatMap((item) => item.content ?? []).find((item) => typeof item.text === 'string')?.text ??
      '';

    return parseDecision(text, this.name);
  }
}
