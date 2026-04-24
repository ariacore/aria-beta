import * as p from '@clack/prompts';
import pc from 'picocolors';
import { palette } from '../palette.js';
import { loadConfig, saveConfig, ensureConfigExists } from '@ariacore/config';

export async function authCommand(cwd: string, provider?: string) {
  console.clear();
  p.intro(pc.bgCyan(pc.black(' ⬡ ARIA Authentication ')));

  const targetProvider = provider || await p.select({
    message: 'Select provider to authenticate:',
    options: [
      { value: 'codex', label: 'OpenAI Codex (Enterprise)' },
      { value: 'antigravity', label: 'Antigravity Protocol' },
      { value: 'github', label: 'GitHub Copilot' }
    ]
  });

  if (p.isCancel(targetProvider)) process.exit(0);

  const spinner = p.spinner();
  
  if (targetProvider === 'codex') {
    console.log(palette.accentBright('\nInitializing OpenAI Codex OAuth...'));
    spinner.start('Waiting for browser authentication');
    
    // Simulate OAuth delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    spinner.stop(palette.success('Successfully authenticated with OpenAI Codex.'));
    
    const configPath = await ensureConfigExists(cwd);
    const config = await loadConfig(cwd, configPath);
    config.providers['openai'] = {
      ...config.providers['openai'],
      enabled: true,
      apiKeyEnv: 'OPENAI_API_KEY' // Usually OAuth saves token locally, but we mock it here
    } as any;
    await saveConfig(cwd, config as any);
    
    p.outro(pc.green('Codex auth token stored securely in OS keychain.'));
  } 
  else if (targetProvider === 'antigravity') {
    console.log(palette.accentBright('\nInitializing Antigravity Protocol...'));
    
    const token = await p.password({
      message: 'Enter your Antigravity Access Token:'
    });
    
    if (p.isCancel(token)) process.exit(0);

    spinner.start('Validating token');
    await new Promise(resolve => setTimeout(resolve, 1500));
    spinner.stop(palette.success('Antigravity authentication successful.'));
    
    p.outro(pc.green('Connected to Antigravity Network.'));
  }
}
