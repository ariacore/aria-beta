import { randomUUID } from 'node:crypto';

import type { AriaLogger } from '@aria/types';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerBindings {
  traceId: string;
  [key: string]: unknown;
}

class JsonLogger implements AriaLogger {
  public constructor(private readonly bindings: LoggerBindings) {}

  public child(bindings: Record<string, unknown>): AriaLogger {
    return new JsonLogger({
      ...this.bindings,
      ...bindings
    });
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  public error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const payload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.bindings,
      ...(meta ?? {})
    };

    const serialized = JSON.stringify(payload);
    if (level === 'error') {
      console.error(serialized);
      return;
    }

    if (level === 'warn') {
      console.warn(serialized);
      return;
    }

    console.log(serialized);
  }
}

export function createLogger(bindings: Record<string, unknown> = {}): AriaLogger {
  return new JsonLogger({
    traceId: randomUUID(),
    ...bindings
  });
}

