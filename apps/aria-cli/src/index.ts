#!/usr/bin/env node
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolve } from 'node:path';

import { AriaAgent } from '@aria/agent';
import { createComputerController } from '@aria/computer';
import { defaultConfig, ensureConfigExists, loadConfig } from '@aria/config';
import {
  renderTelegramCompletion,
  renderTelegramProgress,
  TelegramTransport,
  writeDeliveryArtifacts
} from '@aria/delivery';
import { createProvider } from '@aria/llm';
import { createLogger } from '@aria/logger';
import { DatabaseMemoryStore } from '@aria/memory';
import { createSafetyGate } from '@aria/security';
import type { AriaToolAction, JobRecord, RiskAssessment, AgentEvent } from '@aria/types';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import ora from 'ora';
import { palette } from './palette.js';

async function main(): Promise<void> {
  const [command = 'help', ...rest] = process.argv.slice(2);
  const cwd = process.cwd();
  const logger = createLogger({ component: 'cli' });

  switch (command) {
    case 'help':
      printUsage();
      return;
    case 'onboard': {
      console.clear();
      
      const logo = `
 █████╗ ██████╗ ██╗ █████╗ 
██╔══██╗██╔══██╗██║██╔══██╗
███████║██████╔╝██║███████║
██╔══██║██╔══██╗██║██╔══██║
██║  ██║██║  ██║██║██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝
`;
      console.log(pc.cyan(logo));
      p.intro(pc.bgCyan(pc.black(' ARIA 1.0 - The Autonomous Reasoning & Interaction Agent ')));

      const proceed = await p.confirm({
        message: 'ARIA is a powerful agent that controls your hardware. I understand this is inherently risky. Continue?',
        initialValue: true,
      });

      if (p.isCancel(proceed) || !proceed) {
        p.cancel('Setup cancelled.');
        process.exit(0);
      }

      const configPath = await ensureConfigExists(cwd);
      
      p.note(
        `Checking OS dependencies for ${process.platform}...`,
        'System Diagnostics'
      );
      
      await ensureSystemDependencies();

      p.outro(pc.green(`ARIA config initialized at ${configPath}. Run ${pc.cyan('aria chat')} to begin.`));
      return;
    }
    case 'doctor': {
      const configPath = await ensureConfigExists(cwd);
      const config = await loadConfig(cwd, configPath);
      const report = await buildDoctorReport(config);
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    case 'run': {
      const goal = rest.join(' ').trim();
      if (!goal) {
        throw new Error('Usage: aria run <natural language goal>');
      }

      const configPath = await ensureConfigExists(cwd);
      const config = await loadConfig(cwd, configPath);
      await ensureSystemDependencies();
      const provider = createProvider(config.defaultProvider, config, logger);
      const helperProvider = config.metaCognition.helperProvider
        ? createProvider(config.metaCognition.helperProvider, config, logger)
        : undefined;
          const memory = new DatabaseMemoryStore(resolve(cwd, config.paths.dataDir), logger);
      const safetyGate = createSafetyGate(promptForApproval);
      const computer = createComputerController();
      const telegram = new TelegramTransport(config);

      const agent = new AriaAgent({
        config,
        logger,
        computer,
        provider,
        memory,
        safetyGate,
        confirm: promptForApproval,
        ...(helperProvider ? { helperProvider } : {})
      });

      const spinner = ora({
        text: palette.cyan('Initializing ARIA...'),
        color: 'cyan',
        spinner: 'dots'
      }).start();

      const result = await agent.run(goal, {
        async onEvent(event: AgentEvent) {
          switch (event.type) {
            case 'job_started':
              spinner.text = palette.dim(`Job started: ${event.job.id}`);
              break;
            case 'decision':
              spinner.text = palette.cyan(`Thinking (${event.decision.confidence > 0.8 ? 'fast' : 'deep'})...`);
              break;
            case 'action_executed':
              spinner.succeed(palette.success(`Step ${event.step.index}: ${event.step.result.message}`));
              spinner.start(palette.cyan('Capturing next frame...'));
              if (telegram.isEnabled()) {
                await telegram.sendMessage(renderTelegramProgress(await memory.getJob(event.jobId) ?? resultPlaceholder(event.jobId, goal), event.step));
              }
              break;
            case 'job_completed':
              spinner.succeed(palette.success(`Job completed! ${event.job.id}`));
              if (telegram.isEnabled()) {
                await telegram.sendMessage(renderTelegramCompletion(event.job));
              }
              break;
            case 'job_failed':
              spinner.fail(palette.error(`Job failed: ${event.error}`));
              break;
          }
        }
      });

      const steps = await memory.getSteps(result.job.id);
      const artifacts = await writeDeliveryArtifacts(config, result.job, steps);

      p.outro(palette.success(`Status: ${result.job.status}`));
      if (result.job.summary) {
        console.log(palette.accentBright(`Summary: ${result.job.summary}`));
      }

      if (artifacts.markdownPath) {
        console.log(palette.dim(`Markdown report: ${artifacts.markdownPath}`));
      }

      if (artifacts.htmlPath) {
        console.log(palette.dim(`HTML report: ${artifacts.htmlPath}`));
      }

      return;
    }
    case 'resume': {
      const jobId = rest[0];
      if (!jobId) {
        throw new Error('Usage: aria resume <jobId>');
      }

      const configPath = await ensureConfigExists(cwd);
      const config = await loadConfig(cwd, configPath);
      await ensureSystemDependencies();
      const provider = createProvider(config.defaultProvider, config, logger);
      const helperProvider = config.metaCognition.helperProvider
        ? createProvider(config.metaCognition.helperProvider, config, logger)
        : undefined;
      const memory = new DatabaseMemoryStore(resolve(cwd, config.paths.dataDir), logger);
      const safetyGate = createSafetyGate(promptForApproval);
      const computer = createComputerController();
      const telegram = new TelegramTransport(config);

      const agent = new AriaAgent({
        config,
        logger,
        computer,
        provider,
        memory,
        safetyGate,
        confirm: promptForApproval,
        ...(helperProvider ? { helperProvider } : {})
      });

      const result = await agent.resume(jobId, {
        async onEvent(event: AgentEvent) {
          switch (event.type) {
            case 'job_started':
              console.log(`Resumed job ${event.job.id}`);
              break;
            case 'decision':
              console.log(
                `Step ${event.stepIndex}: ${event.decision.provider} chose ${event.decision.action.tool} (${event.decision.confidence.toFixed(2)})`
              );
              break;
            case 'action_executed':
              console.log(`Executed step ${event.step.index}: ${event.step.result.message}`);
              if (telegram.isEnabled()) {
                await telegram.sendMessage(renderTelegramProgress(await memory.getJob(event.jobId) ?? resultPlaceholder(event.jobId, ''), event.step));
              }
              break;
            case 'job_completed':
              console.log(`Completed job ${event.job.id}`);
              if (telegram.isEnabled()) {
                await telegram.sendMessage(renderTelegramCompletion(event.job));
              }
              break;
            case 'job_failed':
              console.error(`Job ${event.job.id} failed: ${event.error}`);
              break;
          }
        }
      });

      const steps = await memory.getSteps(result.job.id);
      const artifacts = await writeDeliveryArtifacts(config, result.job, steps);

      console.log(`Status: ${result.job.status}`);
      if (result.job.summary) {
        console.log(`Summary: ${result.job.summary}`);
      }

      if (artifacts.markdownPath) {
        console.log(`Markdown report: ${artifacts.markdownPath}`);
      }

      if (artifacts.htmlPath) {
        console.log(`HTML report: ${artifacts.htmlPath}`);
      }

      return;
    }
    case 'serve': {
      const configPath = await ensureConfigExists(cwd);
      const config = await loadConfig(cwd, configPath);
      await ensureSystemDependencies();
      const telegram = new TelegramTransport(config);
      
      if (!telegram.isEnabled()) {
        throw new Error('Telegram delivery is not enabled in config. Run "aria init-config" and configure it.');
      }
      
      console.log('Starting ARIA in background mode (Telegram interface)...');
      
      // Keep process alive and poll
      await telegram.startPolling(async (text: string, messageId: number | string) => {
        console.log(`Received command from Telegram: "${text}"`);
        await telegram.sendMessage(`Received command: "${text}". Starting task...`);
        
        try {
          const provider = createProvider(config.defaultProvider, config, logger);
          const memory = new DatabaseMemoryStore(resolve(cwd, config.paths.dataDir), logger);
          const safetyGate = createSafetyGate(promptForApproval);
          const computer = createComputerController();
          
          const agent = new AriaAgent({
            config,
            logger,
            computer,
            provider,
            memory,
            safetyGate,
            confirm: promptForApproval
          });
          
          await agent.run(text, {
            async onEvent(event: AgentEvent) {
              if (event.type === 'job_completed') {
                await telegram.sendMessage(renderTelegramCompletion(event.job));
              } else if (event.type === 'job_failed') {
                await telegram.sendMessage(`Task failed: ${event.error}`);
              } else if (event.type === 'action_executed') {
                await telegram.sendMessage(renderTelegramProgress(await memory.getJob(event.jobId) ?? resultPlaceholder(event.jobId, text), event.step));
              }
            }
          });
        } catch (err) {
          console.error(err);
          await telegram.sendMessage(`Error running task: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
      return;
    }
    case 'chat': {
      console.clear();
      p.intro(pc.bgCyan(pc.black(' ARIA Interactive TUI ')));
      p.note('Welcome to Jarvis Mode. This interactive TUI is under construction.\nSoon, you will see a persistent sticky status bar and streaming thought output here.', 'Work In Progress');
      p.outro(pc.green('Type /exit to leave.'));
      return;
    }
    default:
      throw new Error(`Unknown command "${command}". Use "aria help".`);
  }
}

function printUsage(): void {
  console.log(`
${pc.cyan('█████╗ ██████╗ ██╗ █████╗ ')}
${pc.cyan('██╔══██╗██╔══██╗██║██╔══██╗')}
${pc.cyan('███████║██████╔╝██║███████║')}
${pc.cyan('██╔══██║██╔══██╗██║██╔══██║')}
${pc.cyan('██║  ██║██║  ██║██║██║  ██║')}
${pc.cyan('╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝')}
${pc.dim('The command line for your digital employee.')}

${pc.bold('MOST USED COMMANDS:')}
  ${pc.green('aria run "<goal>"')}        Execute any job headless
  ${pc.green('aria chat')}                Interactive TUI chat (Jarvis mode)
  ${pc.green('aria onboard')}             Interactive setup wizard
  ${pc.green('aria doctor')}              System health and auto-fix
  ${pc.green('aria job list')}            See all jobs
  ${pc.green('aria resume <jobId>')}      Resume a paused job

Run ${pc.yellow('aria <command> --help')} for detailed usage.
`);
}

async function promptForApproval(assessment: RiskAssessment, action: AriaToolAction): Promise<boolean> {
  const rl = readline.createInterface({ input, output });

  try {
    console.log(`Risk level: ${assessment.level}`);
    console.log(`Reasons: ${assessment.reasons.join('; ')}`);
    console.log(`Action: ${JSON.stringify(action)}`);
    const answer = await rl.question('Approve this action? [y/N] ');
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

async function checkCommand(cmd: string): Promise<boolean> {
  try {
    await execAsync(`which ${cmd}`);
    return true;
  } catch {
    return false;
  }
}

async function installDependenciesOnLinux(missingCmds: string[]): Promise<void> {
  const packagesToInstall: string[] = [];
  
  if (missingCmds.includes('grim') && missingCmds.includes('import')) {
    packagesToInstall.push('imagemagick'); // Default to imagemagick
  }
  if (missingCmds.includes('xdotool')) {
    packagesToInstall.push('xdotool');
  }

  if (packagesToInstall.length === 0) return;

  console.log(`\n[ARIA Setup] Missing OS dependencies detected: ${packagesToInstall.join(', ')}`);
  console.log(`[ARIA Setup] Attempting to install them automatically... (You may be prompted for your sudo password)`);

  let pkgManager = '';
  let installCmd = '';

  if (await checkCommand('apt-get')) {
    pkgManager = 'apt-get';
    installCmd = `sudo apt-get update && sudo apt-get install -y ${packagesToInstall.join(' ')}`;
  } else if (await checkCommand('pacman')) {
    pkgManager = 'pacman';
    installCmd = `sudo pacman -Sy --noconfirm ${packagesToInstall.join(' ')}`;
  } else if (await checkCommand('dnf')) {
    pkgManager = 'dnf';
    installCmd = `sudo dnf install -y ${packagesToInstall.join(' ')}`;
  } else {
    console.warn(`[ARIA Setup] Could not detect supported package manager (apt/pacman/dnf). Please install ${packagesToInstall.join(', ')} manually.`);
    return;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(installCmd, { shell: true, stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[ARIA Setup] Successfully installed ${packagesToInstall.join(', ')}!\n`);
        resolve();
      } else {
        console.warn(`[ARIA Setup] Failed to install dependencies automatically. Please run: ${installCmd}`);
        resolve(); // We resolve anyway so the agent attempts to continue, or fails with the original error later.
      }
    });
    child.on('error', (err) => {
      console.warn(`[ARIA Setup] Failed to install dependencies automatically: ${err.message}`);
      resolve();
    });
  });
}

async function ensureSystemDependencies() {
  const isLinux = process.platform === 'linux';
  if (!isLinux) return;

  const hasGrim = await checkCommand('grim');
  const hasImport = await checkCommand('import');
  const hasXdotool = await checkCommand('xdotool');

  const missingCmds: string[] = [];
  if (!hasGrim && !hasImport) missingCmds.push('grim', 'import');
  if (!hasXdotool) missingCmds.push('xdotool');

  if (missingCmds.length > 0) {
    await installDependenciesOnLinux(missingCmds);
  }
}

async function buildDoctorReport(config: typeof defaultConfig) {
  const isLinux = process.platform === 'linux';
  
  let missingDependencies: string[] = [];
  
  if (isLinux) {
    const hasGrim = await checkCommand('grim');
    const hasImport = await checkCommand('import');
    const hasXdotool = await checkCommand('xdotool');
    
    if (!hasGrim && !hasImport) {
      missingDependencies.push('grim OR ImageMagick (import) - Required for taking screenshots on Linux');
    }
    
    if (!hasXdotool) {
      missingDependencies.push('xdotool - Required for mouse and keyboard control on Linux (X11)');
    }
  }

  return {
    cwd: process.cwd(),
    platform: process.platform,
    nodeVersion: process.version,
    defaultProvider: config.defaultProvider,
    telegramEnabled: config.delivery.telegram.enabled,
    dataDir: resolve(config.paths.dataDir),
    systemDependenciesStatus: missingDependencies.length === 0 ? 'OK' : 'MISSING',
    missingDependencies,
    recommendation: missingDependencies.length > 0 
      ? 'Please install the missing dependencies via your package manager (e.g. sudo apt install xdotool imagemagick)' 
      : 'All system dependencies are met.'
  };
}

function resultPlaceholder(jobId: string, goal: string): JobRecord {
  return {
    id: jobId,
    goal,
    status: 'running',
    startedAt: new Date().toISOString(),
    provider: 'mock',
    totalSteps: 0
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
