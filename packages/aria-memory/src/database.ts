import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import * as lancedb from '@lancedb/lancedb';
import { DatabaseSync } from 'node:sqlite';

import type { AgentStepRecord, AriaLogger, JobRecord, JobStatus, MemoryStore, ProcedureRecord } from '@aria/types';

export class DatabaseMemoryStore implements MemoryStore {
  private db: DatabaseSync;
  private lanceDbPath: string;
  private initialized = false;

  public constructor(
    private readonly rootDir: string,
    private readonly logger: AriaLogger
  ) {
    const dbPath = resolve(rootDir, 'episodic.db');
    this.db = new DatabaseSync(dbPath);
    this.lanceDbPath = resolve(rootDir, 'procedural.lancedb');
    this.initializeSqlite();
  }

  private initializeSqlite(): void {
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        status TEXT NOT NULL,
        startedAt TEXT NOT NULL,
        finishedAt TEXT,
        provider TEXT NOT NULL,
        helperProvider TEXT,
        summary TEXT,
        totalSteps INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS steps (
        id TEXT PRIMARY KEY,
        jobId TEXT NOT NULL,
        stepIndex INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        provider TEXT NOT NULL,
        thought TEXT NOT NULL,
        confidence REAL NOT NULL,
        action TEXT NOT NULL,
        assessment TEXT NOT NULL,
        result TEXT NOT NULL,
        beforeScreenshotId TEXT NOT NULL,
        afterScreenshotId TEXT,
        FOREIGN KEY(jobId) REFERENCES jobs(id)
      );
    `);
  }

  private async getLanceTable(): Promise<lancedb.Table> {
    await mkdir(this.lanceDbPath, { recursive: true });
    const connection = await lancedb.connect(this.lanceDbPath);
    
    try {
      return await connection.openTable('procedures');
    } catch {
      // In a real system, you'd use a real embedding function. 
      // For now, we store them as plain records.
      const schema = {
        id: 'string',
        title: 'string',
        summary: 'string',
        createdAt: 'string',
        sourceJobId: 'string'
      };
      
      const emptyData = [{ 
        id: 'dummy', 
        title: 'dummy', 
        summary: 'dummy', 
        createdAt: 'dummy', 
        sourceJobId: 'dummy', 
        vector: Array(128).fill(0) 
      }];
      
      const table = await connection.createTable('procedures', emptyData);
      await table.delete("id = 'dummy'");
      return table;
    }
  }

  public async startJob(job: JobRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO jobs (id, goal, status, startedAt, finishedAt, provider, helperProvider, summary, totalSteps)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      job.id,
      job.goal,
      job.status,
      job.startedAt,
      job.finishedAt ?? null,
      job.provider,
      job.helperProvider ?? null,
      job.summary ?? null,
      job.totalSteps
    );
    
    this.logger.info('Started job in DatabaseMemoryStore.', { jobId: job.id });
  }

  public async appendStep(jobId: string, step: AgentStepRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO steps (id, jobId, stepIndex, timestamp, provider, thought, confidence, action, assessment, result, beforeScreenshotId, afterScreenshotId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      step.id,
      jobId,
      step.index,
      step.timestamp,
      step.provider,
      step.thought,
      step.confidence,
      JSON.stringify(step.action),
      JSON.stringify(step.assessment),
      JSON.stringify(step.result),
      step.beforeScreenshotId,
      step.afterScreenshotId ?? null
    );
    
    const updateJob = this.db.prepare(`UPDATE jobs SET totalSteps = totalSteps + 1 WHERE id = ?`);
    updateJob.run(jobId);
  }

  public async finishJob(jobId: string, status: JobStatus, summary?: string): Promise<JobRecord> {
    const finishedAt = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE jobs SET status = ?, summary = ?, finishedAt = ? WHERE id = ?
    `);
    stmt.run(status, summary ?? null, finishedAt, jobId);
    
    const job = await this.getJob(jobId);
    if (!job) throw new Error('Job not found after update');

    if (status === 'completed' && summary) {
      await this.rememberProcedure({
        id: `procedure-${jobId}`,
        title: job.goal,
        summary,
        createdAt: finishedAt,
        sourceJobId: jobId
      });
    }

    return job;
  }

  public async getJob(jobId: string): Promise<JobRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM jobs WHERE id = ?');
    const row = stmt.get(jobId) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      goal: row.goal,
      status: row.status as JobStatus,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt ?? undefined,
      provider: row.provider as any,
      helperProvider: row.helperProvider ?? undefined,
      summary: row.summary ?? undefined,
      totalSteps: row.totalSteps
    };
  }

  public async getSteps(jobId: string): Promise<AgentStepRecord[]> {
    const stmt = this.db.prepare('SELECT * FROM steps WHERE jobId = ? ORDER BY stepIndex ASC');
    const rows = stmt.all(jobId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      index: row.stepIndex,
      timestamp: row.timestamp,
      provider: row.provider,
      thought: row.thought,
      confidence: row.confidence,
      action: JSON.parse(row.action),
      assessment: JSON.parse(row.assessment),
      result: JSON.parse(row.result),
      beforeScreenshotId: row.beforeScreenshotId,
      afterScreenshotId: row.afterScreenshotId ?? undefined
    }));
  }

  public async findProcedure(goal: string): Promise<ProcedureRecord | null> {
    const table = await this.getLanceTable();
    // Simple mock text search without embeddings: just fetch all and match
    const rows = await table.query().limit(100).toArray();
    
    const normalizedGoal = goal.toLowerCase();
    const match = rows.find((row: any) => 
      (row.title as string).toLowerCase().includes(normalizedGoal) || 
      (row.summary as string).toLowerCase().includes(normalizedGoal)
    );
    
    if (!match) return null;
    
    return {
      id: match.id as string,
      title: match.title as string,
      summary: match.summary as string,
      createdAt: match.createdAt as string,
      sourceJobId: match.sourceJobId as string
    };
  }

  public async rememberProcedure(procedure: ProcedureRecord): Promise<void> {
    const table = await this.getLanceTable();
    
    // Check if exists
    try {
      await table.delete(`id = '${procedure.id}'`);
    } catch {
      // ignore
    }
    
    const record = {
      ...procedure,
      vector: Array(128).fill(0) // Dummy vector since we are doing simple text match
    };
    
    await table.add([record]);
  }
}
