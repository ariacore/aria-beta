import type { AriaLogger, ProviderAdapter, ProviderPlanRequest, ProviderSettings } from '@ariacore/types';

import { requireEnv } from '../env.js';
import { parseDecision } from '../json.js';
import { buildSystemPrompt, buildUserPrompt, decisionSchema } from '../prompt.js';
import { postJson } from '../http.js';

interface GoogleResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export class GoogleProvider implements ProviderAdapter {
  public readonly name = 'google';

  public constructor(
    private readonly settings: ProviderSettings,
    private readonly logger: AriaLogger
  ) {}

  public async plan(request: ProviderPlanRequest) {
    const apiKey = requireEnv(this.settings.apiKeyEnv ?? 'GEMINI_API_KEY', 'google');
    const model = this.settings.model;
    const response = await postJson<GoogleResponse>(
      this.settings.baseUrl ??
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        body: {
          systemInstruction: {
            parts: [{ text: buildSystemPrompt() }]
          },
          contents: [
            {
              role: 'user',
              parts: [
                { text: buildUserPrompt(request) },
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: request.screenshot.base64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: decisionSchema
          }
        }
      },
      this.logger
    );

    const text = response.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text ?? '';
    return parseDecision(text, this.name);
  }
}
