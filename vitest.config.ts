import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@ariacore/types': resolve('packages/aria-types/src/index.ts'),
      '@ariacore/logger': resolve('packages/aria-logger/src/index.ts'),
      '@ariacore/config': resolve('packages/aria-config/src/index.ts'),
      '@ariacore/computer': resolve('packages/aria-computer/src/index.ts'),
      '@ariacore/llm': resolve('packages/aria-llm/src/index.ts'),
      '@ariacore/agent': resolve('packages/aria-agent/src/index.ts'),
      '@ariacore/memory': resolve('packages/aria-memory/src/index.ts'),
      '@ariacore/delivery': resolve('packages/aria-delivery/src/index.ts'),
      '@ariacore/security': resolve('packages/aria-security/src/index.ts')
    }
  }
});

