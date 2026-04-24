import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import type {
  ActionExecutionResult,
  AgentRunOptions,
  AgentRunResult,
  AgentStepRecord,
  AriaConfig,
  AriaLogger,
  AriaToolAction,
  AuthorizationResult,
  ComputerController,
  ConfirmationPrompt,
  JobRecord,
  MemoryStore,
  ProviderAdapter,
  ProviderDecision,
  SafetyGate
} from '@ariacore/types';

import { defaultAvailableActions } from './tools.js';
import { MetaCognitionService } from './meta-cognition.js';

const execFileAsync = promisify(execFile);

export interface AriaAgentDependencies {
  config: AriaConfig;
  logger: AriaLogger;
  computer: ComputerController;
  provider: ProviderAdapter;
  helperProvider?: ProviderAdapter | undefined;
  memory: MemoryStore;
  safetyGate: SafetyGate;
  confirm: ConfirmationPrompt;
}

export class AriaAgent {
  private readonly metaCognition: MetaCognitionService;

  public constructor(private readonly dependencies: AriaAgentDependencies) {
    this.metaCognition = new MetaCognitionService(
      dependencies.config.metaCognition,
      dependencies.helperProvider,
      dependencies.logger.child({ component: 'meta-cognition' })
    );
  }

  public async run(goal: string, options: AgentRunOptions = {}): Promise<AgentRunResult> {
    const provider = this.dependencies.provider;
    const logger = this.dependencies.logger.child({ component: 'agent-loop' });
    const rememberedProcedure = await this.dependencies.memory.findProcedure(goal);
    const enrichedGoal = rememberedProcedure
      ? `${goal}\n\nKnown successful procedure:\n${rememberedProcedure.summary}`
      : goal;

    const job: JobRecord = {
      id: randomUUID(),
      goal,
      status: 'running',
      startedAt: new Date().toISOString(),
      provider: provider.name,
      helperProvider: this.dependencies.helperProvider?.name ?? null,
      totalSteps: 0
    };

    await this.dependencies.memory.startJob(job);
    await options.onEvent?.({ type: 'job_started', job });
    logger.info('Starting ARIA job.', { jobId: job.id, goal });

    const maxSteps = options.maxSteps ?? this.dependencies.config.execution.maxSteps;
    return this.executeLoop(job, enrichedGoal, [], maxSteps, options);
  }

  public async resume(jobId: string, options: AgentRunOptions = {}): Promise<AgentRunResult> {
    const logger = this.dependencies.logger.child({ component: 'agent-loop' });

    const job = await this.dependencies.memory.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in memory.`);
    }

    const steps = await this.dependencies.memory.getSteps(jobId);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'blocked') {
      logger.info('Cannot resume, job is already finished.', { jobId: job.id, status: job.status });
      return { job, steps };
    }

    const rememberedProcedure = await this.dependencies.memory.findProcedure(job.goal);
    const enrichedGoal = rememberedProcedure
      ? `${job.goal}\n\nKnown successful procedure:\n${rememberedProcedure.summary}`
      : job.goal;

    // Update status back to running if it was paused
    if (job.status !== 'running') {
      job.status = 'running';
      await this.dependencies.memory.startJob(job);
    }

    await options.onEvent?.({ type: 'job_started', job });
    logger.info('Resuming ARIA job.', { jobId: job.id, goal: job.goal, startingStep: steps.length + 1 });

    const maxSteps = options.maxSteps ?? this.dependencies.config.execution.maxSteps;
    return this.executeLoop(job, enrichedGoal, steps, maxSteps, options);
  }

  private async executeLoop(
    job: JobRecord,
    enrichedGoal: string,
    steps: AgentStepRecord[],
    maxSteps: number,
    options: AgentRunOptions
  ): Promise<AgentRunResult> {
    const provider = this.dependencies.provider;
    const logger = this.dependencies.logger.child({ component: 'agent-loop' });
    let currentUrl: string | null | undefined;

    try {
      for (let stepIndex = steps.length + 1; stepIndex <= maxSteps; stepIndex += 1) {
        const beforeScreenshot = await this.dependencies.computer.captureScreenshot();
        await saveScreenshot(this.dependencies.config.paths.artifactsDir, job.id, beforeScreenshot);
        
        const request = {
          goal: enrichedGoal,
          screenshot: beforeScreenshot,
          history: steps,
          availableActions: defaultAvailableActions,
          currentUrl
        };

        const primaryDecision = await provider.plan(request);
        const decision = await this.metaCognition.maybeEscalate(request, primaryDecision);
        await options.onEvent?.({ type: 'decision', jobId: job.id, decision, stepIndex });

        const authorization = await this.dependencies.safetyGate.authorize({
          action: decision.action,
          currentUrl,
          config: this.dependencies.config.safety
        });

        if (!authorization.allowed) {
          const blockedJob = await this.dependencies.memory.finishJob(
            job.id,
            'blocked',
            authorization.deniedReason ?? 'Blocked by the safety gate.'
          );
          await options.onEvent?.({
            type: 'job_failed',
            job: blockedJob,
            error: authorization.deniedReason ?? 'Blocked by the safety gate.'
          });
          return { job: blockedJob, steps };
        }

        if (decision.action.tool === 'complete') {
          const completedJob = await this.dependencies.memory.finishJob(
            job.id,
            'completed',
            decision.action.input.summary
          );
          await options.onEvent?.({ type: 'job_completed', job: completedJob });
          return { job: completedJob, steps };
        }

        const executionResult = await this.executeAction(decision.action);
        currentUrl = executionResult.currentUrl ?? currentUrl;

        const afterScreenshot = await this.dependencies.computer.captureScreenshot();
        await saveScreenshot(this.dependencies.config.paths.artifactsDir, job.id, afterScreenshot);
        
        const step = buildStepRecord({
          index: stepIndex,
          decision,
          authorization,
          beforeScreenshotId: beforeScreenshot.id,
          afterScreenshotId: afterScreenshot.id,
          result: executionResult
        });

        steps.push(step);
        await this.dependencies.memory.appendStep(job.id, step);
        await options.onEvent?.({ type: 'action_executed', jobId: job.id, step });
      }

      const failedJob = await this.dependencies.memory.finishJob(
        job.id,
        'failed',
        `Stopped after reaching the max step limit (${maxSteps}).`
      );
      await options.onEvent?.({
        type: 'job_failed',
        job: failedJob,
        error: `Max step limit reached (${maxSteps}).`
      });
      return { job: failedJob, steps };
    } catch (error) {
      logger.error('ARIA job failed.', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error)
      });

      const failedJob = await this.dependencies.memory.finishJob(
        job.id,
        'failed',
        error instanceof Error ? error.message : String(error)
      );
      await options.onEvent?.({
        type: 'job_failed',
        job: failedJob,
        error: error instanceof Error ? error.message : String(error)
      });
      return { job: failedJob, steps };
    }
  }

  private async executeAction(action: AriaToolAction): Promise<ActionExecutionResult> {
    switch (action.tool) {
      case 'computer':
        return this.dependencies.computer.execute(action.input);
      case 'bash':
        return executeBash(action.input.command);
      case 'editor':
        return executeEditor(action.input);
      case 'complete':
        return {
          success: true,
          message: action.input.summary
        };
    }
  }
}

function buildStepRecord(input: {
  index: number;
  decision: ProviderDecision;
  authorization: AuthorizationResult;
  beforeScreenshotId: string;
  afterScreenshotId: string;
  result: ActionExecutionResult;
}): AgentStepRecord {
  return {
    id: randomUUID(),
    index: input.index,
    timestamp: new Date().toISOString(),
    provider: input.decision.provider,
    thought: input.decision.thought,
    confidence: input.decision.confidence,
    action: input.decision.action,
    assessment: input.authorization.assessment,
    result: input.result,
    beforeScreenshotId: input.beforeScreenshotId,
    afterScreenshotId: input.afterScreenshotId
  };
}

async function saveScreenshot(artifactsDir: string, jobId: string, screenshot: { id: string; base64: string }): Promise<void> {
  try {
    const dir = resolve(process.cwd(), artifactsDir, jobId, 'screenshots');
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, `${screenshot.id}.png`), Buffer.from(screenshot.base64, 'base64'));
  } catch {
    // Ignore errors to not break the agent loop
  }
}

async function executeBash(command: string): Promise<ActionExecutionResult> {
  const shellCommand = process.platform === 'win32' ? 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' : '/bin/sh';
  const shellArgs =
    process.platform === 'win32'
      ? ['-NoProfile', '-Command', command]
      : ['-lc', command];

  const { stdout, stderr } = await execFileAsync(shellCommand, shellArgs, {
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
    encoding: 'utf8',
    windowsHide: true
  });

  return {
    success: true,
    message: stderr.trim().length > 0 ? stderr.trim() : 'Bash command executed successfully.',
    output: stdout.trim()
  };
}

async function executeEditor(action: Extract<AriaToolAction, { tool: 'editor' }>['input']): Promise<ActionExecutionResult> {
  const targetPath = resolve(action.path);

  switch (action.action) {
    case 'view': {
      const output = await readFile(targetPath, 'utf8');
      return {
        success: true,
        message: `Viewed ${targetPath}.`,
        output
      };
    }
    case 'create':
    case 'write': {
      await writeFile(targetPath, action.content ?? '', 'utf8');
      return {
        success: true,
        message: `${action.action === 'create' ? 'Created' : 'Wrote'} ${targetPath}.`
      };
    }
    case 'replace': {
      const current = await readFile(targetPath, 'utf8');
      if (!action.oldText) {
        throw new Error('Editor replace action requires oldText.');
      }

      if (!current.includes(action.oldText)) {
        throw new Error(`Could not find target text in ${targetPath}.`);
      }

      const next = current.replace(action.oldText, action.newText ?? '');
      await writeFile(targetPath, next, 'utf8');
      return {
        success: true,
        message: `Replaced text in ${targetPath}.`
      };
    }
  }
}
