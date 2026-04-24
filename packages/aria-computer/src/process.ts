import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { PlatformCommandError } from './errors.js';

const execFileAsync = promisify(execFile);

export async function runCommand(
  file: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {}
): Promise<string> {
  try {
    const result = await execFileAsync(file, args, {
      cwd: options.cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout: options.timeoutMs ?? 20_000,
      maxBuffer: 20 * 1024 * 1024
    });

    return result.stdout.trim();
  } catch (error) {
    const failure = error as Error & {
      stdout?: string;
      stderr?: string;
      code?: string | number;
    };
    const details = [failure.message, failure.stderr, failure.stdout, failure.code].filter(Boolean).join('\n');
    throw new PlatformCommandError(`Command failed: ${file} ${args.join(' ')}`, details);
  }
}

export async function runPowerShellScript(script: string): Promise<string> {
  const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
  return runCommand(
    'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedCommand],
    { timeoutMs: 30_000 }
  );
}

export async function commandExists(command: string): Promise<boolean> {
  const checker = process.platform === 'win32' ? 'where.exe' : 'which';

  try {
    await runCommand(checker, [command], { timeoutMs: 5_000 });
    return true;
  } catch {
    return false;
  }
}
