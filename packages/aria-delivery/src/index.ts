import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AgentStepRecord, AriaConfig, JobRecord } from '@ariacore/types';

export function renderMarkdownReport(job: JobRecord, steps: AgentStepRecord[]): string {
  const lines = [
    `# ARIA Job ${job.id}`,
    '',
    `- Goal: ${job.goal}`,
    `- Status: ${job.status}`,
    `- Provider: ${job.provider}`,
    `- Started: ${job.startedAt}`,
    `- Finished: ${job.finishedAt ?? 'in progress'}`,
    `- Total steps: ${job.totalSteps}`,
    ''
  ];

  if (job.summary) {
    lines.push('## Summary', '', job.summary, '');
  }

  lines.push('## Steps', '');

  for (const step of steps) {
    lines.push(`### Step ${step.index}`);
    lines.push(`- Thought: ${step.thought}`);
    lines.push(`- Confidence: ${step.confidence.toFixed(2)}`);
    lines.push(`- Action: ${formatAction(step.action)}`);
    lines.push(`- Risk: ${step.assessment.level}`);
    lines.push(`- Result: ${step.result.message}`);
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

export function renderHtmlReport(job: JobRecord, steps: AgentStepRecord[]): string {
  const safe = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

  const stepHtml = steps
    .map(
      (step) => `
        <article>
          <h2>Step ${step.index}</h2>
          <p><strong>Thought:</strong> ${safe(step.thought)}</p>
          <p><strong>Confidence:</strong> ${step.confidence.toFixed(2)}</p>
          <p><strong>Action:</strong> ${safe(formatAction(step.action))}</p>
          <p><strong>Risk:</strong> ${safe(step.assessment.level)}</p>
          <p><strong>Result:</strong> ${safe(step.result.message)}</p>
        </article>
      `
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>ARIA Job ${safe(job.id)}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; color: #101828; background: #f8fafc; }
      main { max-width: 900px; margin: 0 auto; background: white; padding: 2rem; border-radius: 16px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08); }
      article { border-top: 1px solid #e2e8f0; padding-top: 1rem; margin-top: 1rem; }
      code { background: #eff6ff; padding: 0.1rem 0.35rem; border-radius: 6px; }
    </style>
  </head>
  <body>
    <main>
      <h1>ARIA Job ${safe(job.id)}</h1>
      <p><strong>Goal:</strong> ${safe(job.goal)}</p>
      <p><strong>Status:</strong> ${safe(job.status)}</p>
      <p><strong>Provider:</strong> ${safe(job.provider)}</p>
      <p><strong>Started:</strong> ${safe(job.startedAt)}</p>
      <p><strong>Finished:</strong> ${safe(job.finishedAt ?? 'in progress')}</p>
      <p><strong>Total steps:</strong> ${job.totalSteps}</p>
      ${job.summary ? `<section><h2>Summary</h2><p>${safe(job.summary)}</p></section>` : ''}
      <section>
        <h2>Steps</h2>
        ${stepHtml}
      </section>
    </main>
  </body>
</html>
`;
}

export function renderTelegramProgress(job: JobRecord, step: AgentStepRecord): string {
  return [
    `ARIA update for job ${job.id}`,
    `Goal: ${job.goal}`,
    `Step ${step.index}: ${formatAction(step.action)}`,
    `Risk: ${step.assessment.level}`,
    `Result: ${truncate(step.result.message, 200)}`
  ].join('\n');
}

export function renderTelegramCompletion(job: JobRecord): string {
  return [
    `ARIA completed job ${job.id}`,
    `Goal: ${job.goal}`,
    `Status: ${job.status}`,
    `Summary: ${truncate(job.summary ?? 'No summary provided.', 400)}`
  ].join('\n');
}

export { TelegramTransport } from './telegram.js';

export async function writeDeliveryArtifacts(
  config: AriaConfig,
  job: JobRecord,
  steps: AgentStepRecord[]
): Promise<{ markdownPath?: string; htmlPath?: string }> {
  const outputDir = resolve(config.paths.artifactsDir, job.id);
  await mkdir(outputDir, { recursive: true });

  const result: { markdownPath?: string; htmlPath?: string } = {};

  if (config.delivery.markdown) {
    const markdownPath = resolve(outputDir, 'report.md');
    await writeFile(markdownPath, renderMarkdownReport(job, steps), 'utf8');
    result.markdownPath = markdownPath;
  }

  if (config.delivery.html) {
    const htmlPath = resolve(outputDir, 'report.html');
    await writeFile(htmlPath, renderHtmlReport(job, steps), 'utf8');
    result.htmlPath = htmlPath;
  }

  return result;
}

function formatAction(action: AgentStepRecord['action']): string {
  if (action.tool === 'computer') {
    return action.input.action;
  }

  if (action.tool === 'complete') {
    return `complete: ${action.input.summary}`;
  }

  if (action.tool === 'bash') {
    return `bash: ${action.input.command}`;
  }

  return `editor: ${action.input.action} ${action.input.path}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}
