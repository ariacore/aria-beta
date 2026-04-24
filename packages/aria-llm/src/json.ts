import type { AriaToolAction, ProviderDecision, ProviderName } from '@aria/types';

export function parseDecision(raw: string, provider: ProviderName): ProviderDecision {
  const payload = JSON.parse(extractJson(raw)) as {
    thought?: unknown;
    confidence?: unknown;
    action?: unknown;
  };

  if (typeof payload.thought !== 'string') {
    throw new Error(`Provider ${provider} returned a decision without a string thought.`);
  }

  const confidence = typeof payload.confidence === 'number' ? payload.confidence : 0;
  const action = validateAction(payload.action);

  return {
    provider,
    thought: payload.thought,
    confidence: Math.max(0, Math.min(1, confidence)),
    action,
    rawResponse: raw
  };
}

export function extractJson(value: string): string {
  const first = value.indexOf('{');
  const last = value.lastIndexOf('}');

  if (first === -1 || last === -1 || first >= last) {
    throw new Error('Model response did not contain JSON.');
  }

  return value.slice(first, last + 1);
}

function validateAction(action: unknown): AriaToolAction {
  if (!isRecord(action)) {
    throw new Error('Decision action must be an object.');
  }

  const tool = action.tool;
  const input = action.input;

  if (tool !== 'computer' && tool !== 'bash' && tool !== 'editor' && tool !== 'complete') {
    throw new Error(`Unsupported decision tool: ${String(tool)}`);
  }

  if (!isRecord(input)) {
    throw new Error('Decision action.input must be an object.');
  }

  return {
    tool,
    input
  } as AriaToolAction;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

