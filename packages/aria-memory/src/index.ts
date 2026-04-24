import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AgentStepRecord, AriaLogger, JobRecord, JobStatus, MemoryStore, ProcedureRecord } from '@ariacore/types';

interface PersistedJob {
  job: JobRecord;
  steps: AgentStepRecord[];
}

interface ProcedureIndex {
  procedures: ProcedureRecord[];
}

export class FileMemoryStore implements MemoryStore {
  public constructor(
    private readonly rootDir: string,
    private readonly logger: AriaLogger
  ) {}

  public async startJob(job: JobRecord): Promise<void> {
    const payload: PersistedJob = { job, steps: [] };
    await this.writeJob(job.id, payload);
    this.logger.info('Started job in memory store.', { jobId: job.id });
  }

  public async appendStep(jobId: string, step: AgentStepRecord): Promise<void> {
    const payload = await this.requireJob(jobId);
    payload.steps.push(step);
    payload.job.totalSteps = payload.steps.length;
    await this.writeJob(jobId, payload);
  }

  public async finishJob(jobId: string, status: JobStatus, summary?: string): Promise<JobRecord> {
    const payload = await this.requireJob(jobId);
    payload.job.status = status;
    payload.job.summary = summary;
    payload.job.finishedAt = new Date().toISOString();
    payload.job.totalSteps = payload.steps.length;
    await this.writeJob(jobId, payload);

    if (status === 'completed' && summary) {
      await this.rememberProcedure({
        id: `procedure-${jobId}`,
        title: payload.job.goal,
        summary,
        createdAt: payload.job.finishedAt,
        sourceJobId: jobId
      });
    }

    return payload.job;
  }

  public async getJob(jobId: string): Promise<JobRecord | null> {
    try {
      const payload = await this.requireJob(jobId);
      return payload.job;
    } catch {
      return null;
    }
  }

  public async getSteps(jobId: string): Promise<AgentStepRecord[]> {
    const payload = await this.requireJob(jobId);
    return payload.steps;
  }

  public async findProcedure(goal: string): Promise<ProcedureRecord | null> {
    const index = await this.readProcedureIndex();
    const normalizedGoal = goal.toLowerCase();

    return (
      index.procedures.find(
        (procedure) =>
          normalizedGoal.includes(procedure.title.toLowerCase()) ||
          procedure.summary.toLowerCase().includes(normalizedGoal)
      ) ?? null
    );
  }

  public async rememberProcedure(procedure: ProcedureRecord): Promise<void> {
    const index = await this.readProcedureIndex();
    const withoutDuplicate = index.procedures.filter((entry) => entry.id !== procedure.id);
    withoutDuplicate.push(procedure);
    await this.writeProcedureIndex({ procedures: withoutDuplicate });
  }

  private async requireJob(jobId: string): Promise<PersistedJob> {
    const path = resolve(this.rootDir, 'jobs', jobId, 'job.json');
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as PersistedJob;
  }

  private async writeJob(jobId: string, payload: PersistedJob): Promise<void> {
    const directory = resolve(this.rootDir, 'jobs', jobId);
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'job.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  private async readProcedureIndex(): Promise<ProcedureIndex> {
    const path = resolve(this.rootDir, 'procedures', 'index.json');

    try {
      const raw = await readFile(path, 'utf8');
      return JSON.parse(raw) as ProcedureIndex;
    } catch {
      return { procedures: [] };
    }
  }

  private async writeProcedureIndex(index: ProcedureIndex): Promise<void> {
    const directory = resolve(this.rootDir, 'procedures');
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  }
}

export { DatabaseMemoryStore } from './database.js';

