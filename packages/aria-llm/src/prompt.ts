import type { ProviderPlanRequest } from '@aria/types';

export const decisionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['thought', 'confidence', 'action'],
  properties: {
    thought: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    action: {
      type: 'object',
      additionalProperties: false,
      required: ['tool', 'input'],
      properties: {
        tool: { type: 'string', enum: ['computer', 'bash', 'editor', 'complete'] },
        input: { type: 'object' }
      }
    }
  }
} as const;

export function buildSystemPrompt(): string {
  return [
    'You are ARIA, a pure-vision computer-use decision engine.',
    'Your job is to look at the screenshot, understand the user goal, and decide the single best next action.',
    'Rules:',
    '1. Return strict JSON only.',
    '2. Use screenshot-visible evidence only. Do not invent hidden UI.',
    '3. ARIA V1 is pure vision. Do not rely on DOM, selectors, or browser internals.',
    '4. Prefer one safe, reversible action at a time.',
    '5. Use tool="complete" only when the job is actually done.',
    '6. Use tool="computer" for screenshot, mouse, keyboard, scroll, and wait.',
    '7. Use tool="bash" or tool="editor" only when the user goal clearly requires terminal or file manipulation.',
    '8. Keep "thought" concise and operational.',
    '9. Confidence must be between 0 and 1.'
  ].join('\n');
}

export function buildUserPrompt(request: ProviderPlanRequest): string {
  const history = request.history
    .slice(-6)
    .map(
      (step) =>
        `Step ${step.index}: action=${formatAction(step.action.tool, JSON.stringify(step.action.input))}; result=${step.result.message}; confidence=${step.confidence.toFixed(2)}`
    )
    .join('\n');

  return [
    `Goal: ${request.goal}`,
    `Screenshot dimensions: ${request.screenshot.width}x${request.screenshot.height}`,
    request.currentUrl ? `Current URL hint: ${request.currentUrl}` : 'Current URL hint: unknown',
    `Available actions: ${request.availableActions.join(', ')}`,
    history.length > 0 ? `Recent history:\n${history}` : 'Recent history: none yet',
    'Return JSON in this shape:',
    '{"thought":"...","confidence":0.0,"action":{"tool":"computer","input":{"action":"left_click","coordinate":[100,200]}}}'
  ].join('\n\n');
}

function formatAction(tool: string, input: string): string {
  return `${tool}:${input}`;
}

