import type { AriaConfig, AriaLogger, ProviderAdapter, ProviderName, ProviderSettings } from '@aria/types';

import { AnthropicProvider } from './providers/anthropic.js';
import { GoogleProvider } from './providers/google.js';
import { GroqProvider } from './providers/groq.js';
import { LmStudioProvider } from './providers/lmstudio.js';
import { MockProvider } from './providers/mock.js';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAiProvider } from './providers/openai.js';
import { OpenRouterProvider } from './providers/openrouter.js';

export function createProvider(name: ProviderName, config: AriaConfig, logger: AriaLogger): ProviderAdapter {
  const settings = getProviderSettings(name, config);
  const childLogger = logger.child({ component: 'provider', provider: name });

  switch (name) {
    case 'anthropic':
      return new AnthropicProvider(settings, childLogger);
    case 'openai':
      return new OpenAiProvider(settings, childLogger);
    case 'google':
      return new GoogleProvider(settings, childLogger);
    case 'openrouter':
      return new OpenRouterProvider(settings, childLogger);
    case 'groq':
      return new GroqProvider();
    case 'ollama':
      return new OllamaProvider(settings, childLogger);
    case 'lmstudio':
      return new LmStudioProvider(settings, childLogger);
    case 'mock':
      return new MockProvider();
    default:
      throw new Error(`Unsupported provider ${name}`);
  }
}

function getProviderSettings(name: ProviderName, config: AriaConfig): ProviderSettings {
  const settings = config.providers[name];
  if (!settings || !settings.enabled) {
    throw new Error(`Provider "${name}" is not enabled in aria.config.json.`);
  }

  return settings;
}

export { MockProvider } from './providers/mock.js';
