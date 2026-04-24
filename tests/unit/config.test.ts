import { describe, expect, it } from 'vitest';

import { defaultConfig, validateConfig } from '@ariacore/config';

describe('config validation', () => {
  it('accepts a valid partial config and merges defaults', () => {
    const config = validateConfig({
      defaultProvider: 'mock',
      providers: {
        mock: {
          enabled: true,
          model: 'mock-vision'
        }
      }
    });

    expect(config.defaultProvider).toBe('mock');
    expect(config.execution.maxSteps).toBe(defaultConfig.execution.maxSteps);
    expect(config.providers.mock?.model).toBe('mock-vision');
  });

  it('rejects configs whose default provider is disabled', () => {
    expect(() =>
      validateConfig({
        defaultProvider: 'anthropic',
        providers: {
          mock: {
            enabled: true,
            model: 'mock-vision'
          }
        }
      })
    ).toThrowError(/not enabled/);
  });
});

