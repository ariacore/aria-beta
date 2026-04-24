import * as p from '@clack/prompts';
import pc from 'picocolors';
import { palette } from '../palette.js';
import { defaultConfig, saveConfig, loadConfig, ensureConfigExists } from '@ariacore/config';
import { resolve } from 'node:path';
import { appendFile } from 'node:fs/promises';

export async function onboardCommand(cwd: string) {
  console.clear();
  const logo = `
┌─────────────────────────────────────────────────────────────────────┐
│ ⬡ ARIA  ⬡                                                           │
│ ARIA 1.0.0 — Your computer, working while you sleep.                │
└─────────────────────────────────────────────────────────────────────┘`;
  console.log(pc.cyan(logo));
  
  p.intro(pc.bgCyan(pc.black(' ⬡ ARIA onboarding ')));

  console.log(`
${pc.bold(palette.warn('◆ Security ────────────────────────────────────────────────────────'))}

  Security warning — please read.

  ARIA controls your entire computer. It can move your mouse, type on
  your keyboard, run terminal commands, and access all your files.

  A bad prompt or a compromised model response can cause real damage.
  Destructive actions (delete, submit, purchase, send) always require
  your explicit confirmation — but you should still understand the risk.

  Recommended baseline:
  — Set confirmation level to "sensitive" for your first week
  — Use sandboxed mode for unfamiliar tasks
  — Keep your API keys in the OS keychain, not in config files
  — Run: aria security audit --fix   after onboarding

  Must read: https://aria-agent.dev/security
`);

  const proceed = await p.confirm({
    message: palette.warn('I understand this is powerful and inherently risky. Continue?'),
    initialValue: true,
  });

  if (p.isCancel(proceed) || !proceed) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  const mode = await p.select({
    message: palette.accentBright('Onboarding mode'),
    options: [
      { value: 'quickstart', label: 'QuickStart', hint: 'Recommended' },
      { value: 'advanced', label: 'Advanced', hint: 'Full control' }
    ]
  });

  if (p.isCancel(mode)) process.exit(0);

  const configPath = resolve(cwd, 'aria.config.json');
  let config = { ...defaultConfig };
  
  try {
    const existing = await loadConfig(cwd, configPath);
    config = { ...config, ...existing };
    console.log(`\n${palette.accentBright('◆ Existing config detected')}`);
    console.log(`workspace: ${config.paths.dataDir}`);
    console.log(`model: ${config.defaultProvider}`);
    console.log(`telegram enabled: ${config.delivery.telegram.enabled}\n`);
    
    const action = await p.select({
      message: palette.accentBright('Config handling'),
      options: [
        { value: 'keep', label: 'Use existing values' },
        { value: 'update', label: 'Update values' },
        { value: 'reset', label: 'Reset to default' }
      ]
    });
    
    if (p.isCancel(action)) process.exit(0);
    if (action === 'reset') config = { ...defaultConfig };
    if (action === 'keep') {
      p.outro(pc.green('Onboarding complete. Run ' + pc.cyan('aria chat') + ' to begin.'));
      return;
    }
  } catch (e) {
    // Config doesn't exist, proceed.
  }

  const provider = await p.select({
    message: palette.accentBright('Model/auth provider'),
    options: [
      { value: 'anthropic', label: 'Anthropic', hint: 'Best for computer use' },
      { value: 'openai', label: 'OpenAI' },
      { value: 'google', label: 'Google Gemini' },
      { value: 'ollama', label: 'Ollama', hint: 'Local, free' },
      { value: 'openrouter', label: 'OpenRouter' }
    ]
  });
  if (p.isCancel(provider)) process.exit(0);
  config.defaultProvider = provider as any;

  let envWrites = '';

  if (provider !== 'ollama') {
    const apiKey = await p.text({
      message: `Enter your ${provider} API Key:`,
      placeholder: 'sk-...'
    });
    if (p.isCancel(apiKey)) process.exit(0);
    const envVarName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 
                       provider === 'openai' ? 'OPENAI_API_KEY' : 
                       provider === 'google' ? 'GEMINI_API_KEY' : 'ARIA_API_KEY';
    config.providers[provider as keyof typeof config.providers] = {
      ...config.providers[provider as keyof typeof config.providers],
      enabled: true,
      apiKeyEnv: envVarName
    } as any;
    envWrites += `${envVarName}=${apiKey}\n`;
  }

  const telegram = await p.confirm({
    message: 'Enable Telegram remote control?',
    initialValue: false
  });
  if (p.isCancel(telegram)) process.exit(0);
  
  if (telegram) {
    const token = await p.text({
      message: 'Enter Telegram Bot Token:',
      placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
    });
    if (p.isCancel(token)) process.exit(0);
    const chatId = await p.text({
      message: 'Enter your Telegram Chat ID:',
      placeholder: '123456789'
    });
    if (p.isCancel(chatId)) process.exit(0);
    
    config.delivery.telegram.enabled = true;
    envWrites += `ARIA_TELEGRAM_BOT_TOKEN=${token}\n`;
    envWrites += `ARIA_TELEGRAM_CHAT_ID=${chatId}\n`;
  }

  const spinner = p.spinner();
  spinner.start('Saving configuration');
  await saveConfig(cwd, config as any);
  if (envWrites) {
    await appendFile(resolve(cwd, '.env'), envWrites, 'utf8');
  }
  spinner.stop('Configuration saved successfully.');
  
  p.outro(pc.green('ARIA is ready! Run ' + pc.cyan('aria chat') + ' to begin your JARVIS experience.'));
}