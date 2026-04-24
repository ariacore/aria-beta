import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { AriaAgent } from '@aria/agent';
import { createComputerController } from '@aria/computer';
import { defaultConfig } from '@aria/config';
import { createLogger } from '@aria/logger';
import { createSafetyGate } from '@aria/security';
import type {
  ActionExecutionResult,
  AgentStepRecord,
  ComputerController,
  DisplayBounds,
  JobRecord,
  JobStatus,
  MemoryStore,
  ProcedureRecord,
  ProviderAdapter,
  ProviderPlanRequest,
  ScreenshotArtifact
} from '@aria/types';

class FakeComputer implements ComputerController {
  public async captureScreenshot(): Promise<ScreenshotArtifact> {
    return {
      id: randomUUID(),
      mimeType: 'image/png',
      base64: 'AAAA',
      width: 10,
      height: 10,
      capturedAt: new Date().toISOString()
    };
  }

  public async execute(): Promise<ActionExecutionResult> {
    return {
      success: true,
      message: 'Executed fake action.'
    };
  }

  public async getDisplayBounds(): Promise<DisplayBounds> {
    return {
      id: 'primary',
      width: 10,
      height: 10,
      originX: 0,
      originY: 0,
      scaleFactor: 1
    };
  }
}

class InMemoryStore implements MemoryStore {
  private job: JobRecord | null = null;
  private readonly steps: AgentStepRecord[] = [];

  public async startJob(job: JobRecord): Promise<void> {
    this.job = { ...job };
  }

  public async appendStep(_jobId: string, step: AgentStepRecord): Promise<void> {
    this.steps.push(step);
  }

  public async finishJob(_jobId: string, status: JobStatus, summary?: string): Promise<JobRecord> {
    if (!this.job) {
      throw new Error('Job not started.');
    }

    this.job = {
      ...this.job,
      status,
      summary,
      finishedAt: new Date().toISOString(),
      totalSteps: this.steps.length
    };

    return this.job;
  }

  public async getJob(): Promise<JobRecord | null> {
    return this.job;
  }

  public async getSteps(): Promise<AgentStepRecord[]> {
    return this.steps;
  }

  public async findProcedure(_goal: string): Promise<ProcedureRecord | null> {
    return null;
  }

  public async rememberProcedure(_procedure: ProcedureRecord): Promise<void> {}
}

class ScriptedProvider implements ProviderAdapter {
  public readonly name = 'mock';
  private index = 0;

  public async plan(_request: ProviderPlanRequest) {
    this.index += 1;
    if (this.index === 1) {
      return {
        provider: 'mock' as const,
        thought: 'Take a screenshot first.',
        confidence: 0.9,
        action: {
          tool: 'computer' as const,
          input: { action: 'screenshot' as const }
        }
      };
    }

    return {
      provider: 'mock' as const,
      thought: 'We are done.',
      confidence: 0.95,
      action: {
        tool: 'complete' as const,
        input: { summary: 'Finished scripted test.' }
      }
    };
  }
}

describe('ARIA agent loop', () => {
  it('runs a minimal job to completion', async () => {
    const store = new InMemoryStore();
    const agent = new AriaAgent({
      config: defaultConfig,
      logger: createLogger(),
      computer: new FakeComputer(),
      provider: new ScriptedProvider(),
      memory: store,
      safetyGate: createSafetyGate(async () => true),
      confirm: async () => true
    });

    const result = await agent.run('take a screenshot then stop', { maxSteps: 3 });

    expect(result.job.status).toBe('completed');
    expect(result.job.summary).toContain('Finished scripted test');
    expect(result.steps).toHaveLength(1);
  });
});
