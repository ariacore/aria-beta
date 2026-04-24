import { createTransport } from 'nodemailer';
import type { AriaConfig, JobRecord, AgentStepRecord } from '@aria/types';
import { renderHtmlReport } from './index.js';

export class EmailTransport {
  public constructor(private readonly config: AriaConfig) {}

  public isEnabled(): boolean {
    return this.config.delivery.email.enabled;
  }

  public async sendReport(job: JobRecord, steps: AgentStepRecord[]): Promise<void> {
    if (!this.isEnabled()) return;

    const smtpUrl = process.env[this.config.delivery.email.smtpUrlEnv];
    const from = process.env[this.config.delivery.email.fromEnv];
    const to = process.env[this.config.delivery.email.toEnv];

    if (!smtpUrl || !from || !to) {
      throw new Error(
        `Email delivery enabled but env vars ${this.config.delivery.email.smtpUrlEnv}, ${this.config.delivery.email.fromEnv}, or ${this.config.delivery.email.toEnv} are missing.`
      );
    }

    const transporter = createTransport(smtpUrl);
    const html = renderHtmlReport(job, steps);

    await transporter.sendMail({
      from,
      to,
      subject: `ARIA Job Report: ${job.goal}`,
      html
    });
  }
}
