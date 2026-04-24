import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AriaConfig, ProviderName, ProviderSettings } from '@aria/types';

const providerNames: ProviderName[] = [
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'groq',
  'ollama',
  'lmstudio',
  'mock'
];

export const defaultConfig: AriaConfig = {
  defaultProvider: 'mock',
  providers: {
    mock: {
      enabled: true,
      baseUrl: 'mock://local',
      model: 'mock-vision'
    }
  },
  execution: {
    mode: 'native',
    captureDisplay: 'primary',
    screenshotFormat: 'png',
    maxSteps: 20,
    defaultWaitMs: 500
  },
  metaCognition: {
    enabled: true,
    helperProvider: null,
    escalationConfidenceThreshold: 0.45,
    maxEscalationsPerJob: 2
  },
  safety: {
    requireConfirmationFor: ['destructive', 'sensitive'],
    blockedDomains: ['banking', 'admin', 'payment'],
    maxCostUsdPerJob: 5,
    maxRuntimeMinutes: 20
  },
  paths: {
    workspaceRoot: '.',
    dataDir: '.aria',
    artifactsDir: '.aria/artifacts'
  },
  delivery: {
    markdown: true,
    html: true,
    telegram: {
      enabled: false,
      botTokenEnv: 'ARIA_TELEGRAM_BOT_TOKEN',
      chatIdEnv: 'ARIA_TELEGRAM_CHAT_ID'
    }
  }
};

export async function loadConfig(cwd: string, explicitPath?: string): Promise<AriaConfig> {
  const configPath = resolveConfigPath(cwd, explicitPath);
  const raw = JSON.parse(await readFile(configPath, 'utf8')) as unknown;
  return validateConfig(raw);
}

export async function ensureConfigExists(cwd: string, explicitPath?: string): Promise<string> {
  const configPath = resolveConfigPath(cwd, explicitPath);

  try {
    await readFile(configPath, 'utf8');
    return configPath;
  } catch {
    await mkdir(resolve(configPath, '..'), { recursive: true });
    await writeFile(configPath, `${JSON.stringify(defaultConfig, null, 2)}\n`, 'utf8');
    return configPath;
  }
}

export function resolveConfigPath(cwd: string, explicitPath?: string): string {
  return explicitPath ? resolve(cwd, explicitPath) : resolve(cwd, 'aria.config.json');
}

export function validateConfig(raw: unknown): AriaConfig {
  if (!isRecord(raw)) {
    throw new Error('ARIA config must be a JSON object.');
  }

  const mergedProviders = mergeProviders(raw.providers);
  const config: AriaConfig = {
    defaultProvider: validateProviderName(raw.defaultProvider, 'defaultProvider'),
    providers: mergedProviders,
    execution: {
      ...defaultConfig.execution,
      ...assertRecord(raw.execution, 'execution'),
      captureDisplay: 'primary',
      screenshotFormat: 'png'
    },
    metaCognition: {
      ...defaultConfig.metaCognition,
      ...assertRecord(raw.metaCognition, 'metaCognition'),
      helperProvider:
        raw.metaCognition && isRecord(raw.metaCognition) && raw.metaCognition.helperProvider !== null
          ? validateProviderName(raw.metaCognition.helperProvider, 'metaCognition.helperProvider')
          : null
    },
    safety: {
      ...defaultConfig.safety,
      ...assertRecord(raw.safety, 'safety'),
      requireConfirmationFor: validateRiskList(
        assertRecord(raw.safety, 'safety').requireConfirmationFor ?? defaultConfig.safety.requireConfirmationFor
      ),
      blockedDomains: validateStringArray(
        assertRecord(raw.safety, 'safety').blockedDomains ?? defaultConfig.safety.blockedDomains,
        'safety.blockedDomains'
      )
    },
    paths: {
      ...defaultConfig.paths,
      ...assertRecord(raw.paths, 'paths')
    },
    delivery: {
      ...defaultConfig.delivery,
      ...assertRecord(raw.delivery, 'delivery'),
      telegram: {
        ...defaultConfig.delivery.telegram,
        ...assertRecord(assertRecord(raw.delivery, 'delivery').telegram, 'delivery.telegram')
      }
    }
  };

  if (!config.providers[config.defaultProvider]?.enabled) {
    throw new Error(`Default provider "${config.defaultProvider}" is not enabled in providers.`);
  }

  return config;
}

function mergeProviders(rawProviders: unknown): Partial<Record<ProviderName, ProviderSettings>> {
  if (rawProviders === undefined) {
    return defaultConfig.providers;
  }

  const candidate = assertRecord(rawProviders, 'providers');
  const merged: Partial<Record<ProviderName, ProviderSettings>> = {};

  for (const name of providerNames) {
    const value = candidate[name];
    if (value === undefined) {
      if (defaultConfig.providers[name]) {
        merged[name] = defaultConfig.providers[name];
      }
      continue;
    }

    const provider = assertRecord(value, `providers.${name}`);
    merged[name] = {
      enabled: Boolean(provider.enabled),
      model: validateString(provider.model, `providers.${name}.model`),
      apiKeyEnv: optionalString(provider.apiKeyEnv, `providers.${name}.apiKeyEnv`),
      baseUrl: optionalString(provider.baseUrl, `providers.${name}.baseUrl`),
      helperOnly: provider.helperOnly === undefined ? undefined : Boolean(provider.helperOnly),
      headers: validateStringRecord(provider.headers, `providers.${name}.headers`)
    };
  }

  return merged;
}

function validateProviderName(value: unknown, field: string): ProviderName {
  if (typeof value !== 'string' || !providerNames.includes(value as ProviderName)) {
    throw new Error(`${field} must be one of: ${providerNames.join(', ')}.`);
  }

  return value as ProviderName;
}

function validateRiskList(value: unknown): Array<'safe' | 'sensitive' | 'destructive'> {
  const allowed = ['safe', 'sensitive', 'destructive'] as const;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !allowed.includes(item as never))) {
    throw new Error(`safety.requireConfirmationFor must only contain: ${allowed.join(', ')}.`);
  }

  return [...value] as Array<'safe' | 'sensitive' | 'destructive'>;
}

function validateStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${field} must be an array of strings.`);
  }

  return [...value];
}

function validateString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }

  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return validateString(value, field);
}

function validateStringRecord(value: unknown, field: string): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`${field} must be an object of string headers.`);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, validateString(entry, `${field}.${key}`)])
  );
}

function assertRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    throw new Error(`${field} must be an object.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

