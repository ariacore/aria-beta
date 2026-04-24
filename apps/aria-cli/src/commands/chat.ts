import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolve } from 'node:path';
import { AriaAgent } from '@ariacore/agent';
import { createComputerController } from '@ariacore/computer';
import { loadConfig, ensureConfigExists } from '@ariacore/config';
import { TelegramTransport } from '@ariacore/delivery';
import { createProvider } from '@ariacore/llm';
import { createLogger } from '@ariacore/logger';
import { DatabaseMemoryStore } from '@ariacore/memory';
import { createSafetyGate } from '@ariacore/security';
import pc from 'picocolors';
import { palette } from '../palette.js';
import type { AgentEvent } from '@ariacore/types';

export async function chatCommand(cwd: string) {
  console.clear();
  console.log(pc.bgCyan(pc.black(' ⬡ ARIA Chat (Jarvis Mode) ')));
  console.log(palette.dim('Type your goal in natural language. Type /help for commands. /exit to quit.\n'));

  const configPath = await ensureConfigExists(cwd);
  const config = await loadConfig(cwd, configPath);
  const logger = createLogger({ component: 'cli' });
  const provider = createProvider(config.defaultProvider, config, logger);
  const memory = new DatabaseMemoryStore(resolve(cwd, config.paths.dataDir), logger);
  
  const safetyGate = createSafetyGate(async (assessment, action) => {
    console.log(`\n${palette.error('◆ Safety Gate:')} ${assessment.level}`);
    console.log(`Reason: ${assessment.reasons.join(', ')}`);
    console.log(`Action: ${JSON.stringify(action)}`);
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(palette.warn('Approve? [y/N] '));
    rl.close();
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  });

  const computer = createComputerController();
  const agent = new AriaAgent({
    config, logger, computer, provider, memory, safetyGate,
    confirm: async () => true // overridden by safetyGate
  });

  const rl = readline.createInterface({ input, output });
  let tokenCount = 0;
  let cost = 0;
  let steps = 0;
  let activeStatus = 'idle';

  const renderStatus = (status: string) => {
    activeStatus = status;
    process.stdout.write('\x1b[s'); // Save cursor position
    process.stdout.write(`\x1b[${process.stdout.rows};1H`); // Move to bottom
    process.stdout.write('\x1b[K'); // Clear line
    const spinnerStr = status === 'running' ? '⬡ running • ' : `⬡ ${status} `;
    const bar = ` ${spinnerStr}| connected  ───────────────────────────────────────────────────────────\n agent main | session local | ${config.defaultProvider} | think medium | screen auto | steps ${steps}/∞ | cost $${cost.toFixed(4)} | tokens ${tokenCount}k`;
    process.stdout.write(pc.bgBlack(palette.cyan(bar)));
    process.stdout.write('\x1b[u'); // Restore cursor position
  };

  renderStatus('idle');

  const ask = async () => {
    const goal = await rl.question(pc.bold(palette.accentBright('\nYou: ')));
    if (goal.trim() === '/exit') {
      console.log('Goodbye.');
      process.exit(0);
    }
    if (goal.trim() === '/help') {
      console.log(palette.dim('Commands: /exit, /status, /clear, /screenshot'));
      return ask();
    }
    if (goal.trim() === '') return ask();

    console.log(pc.bold(palette.cyan('ARIA: ')) + 'On it. Let me figure this out.');
    renderStatus('running');

    try {
      await agent.run(goal, {
        async onEvent(event: AgentEvent) {
          if (event.type === 'decision') {
            console.log(palette.dim(`[Thinking] ${event.decision.thought}`));
          } else if (event.type === 'action_executed') {
            steps++;
            console.log(palette.success(`[Action] ${event.step.result.message}`));
            renderStatus('running');
          } else if (event.type === 'job_completed') {
            console.log(pc.bold(palette.success('ARIA: ')) + 'Job completed successfully.');
            renderStatus('idle');
          } else if (event.type === 'job_failed') {
            console.log(pc.bold(palette.error('ARIA: ')) + `Task failed: ${event.error}`);
            renderStatus('idle');
          }
        }
      });
    } catch (e: any) {
      console.log(pc.bold(palette.error('Error: ')) + e.message);
      renderStatus('idle');
    }
    
    ask();
  };

  ask();
}
