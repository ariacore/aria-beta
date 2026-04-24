import type { AriaLogger, ProviderAdapter, ProviderPlanRequest, ProviderSettings } from '@aria/types';

import { parseDecision } from '../json.js';
import { buildSystemPrompt, buildUserPrompt, decisionSchema } from '../prompt.js';
import { postJson } from '../http.js';

interface OllamaResponse {
  message?: {
    content?: string;
  };
}

export class OllamaProvider implements ProviderAdapter {
  public readonly name = 'ollama';

  public constructor(
    private readonly settings: ProviderSettings,
    private readonly logger: AriaLogger
  ) {}

  public async plan(request: ProviderPlanRequest) {
    const response = await postJson<OllamaResponse>(
      this.settings.baseUrl ?? 'http://127.0.0.1:11434/api/chat',
      {
        body: {
          model: this.settings.model,
          stream: false,
          format: decisionSchema,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            {
              role: 'user',
              content: buildUserPrompt(request),
              images: [request.screenshot.base64]
            }
          ]
        }
      },
      this.logger
    );

    return parseDecision(response.message?.content ?? '', this.name);
  }
}

