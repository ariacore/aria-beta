import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@aria/types': resolve('packages/aria-types/src/index.ts'),
      '@aria/logger': resolve('packages/aria-logger/src/index.ts'),
      '@aria/config': resolve('packages/aria-config/src/index.ts'),
      '@aria/computer': resolve('packages/aria-computer/src/index.ts'),
      '@aria/llm': resolve('packages/aria-llm/src/index.ts'),
      '@aria/agent': resolve('packages/aria-agent/src/index.ts'),
      '@aria/memory': resolve('packages/aria-memory/src/index.ts'),
      '@aria/delivery': resolve('packages/aria-delivery/src/index.ts'),
      '@aria/security': resolve('packages/aria-security/src/index.ts')
    }
  }
});

