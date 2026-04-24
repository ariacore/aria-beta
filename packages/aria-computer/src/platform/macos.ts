import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ActionExecutionResult, ComputerController, DisplayBounds, ScreenAction, ScreenshotArtifact } from '@ariacore/types';

import { PlatformCommandError } from '../errors.js';
import { commandExists, runCommand } from '../process.js';

export class MacOsComputerPlatform implements ComputerController {
  public async captureScreenshot(): Promise<ScreenshotArtifact> {
    const directory = await mkdtemp(join(tmpdir(), 'aria-macos-shot-'));
    const filePath = join(directory, 'screen.png');

    await runCommand('screencapture', ['-x', '-t', 'png', filePath]);

    const base64 = (await readFile(filePath)).toString('base64');
    const bounds = await this.getDisplayBounds();
    return {
      id: randomUUID(),
      mimeType: 'image/png',
      base64,
      width: bounds.width,
      height: bounds.height,
      capturedAt: new Date().toISOString()
    };
  }

  public async getDisplayBounds(): Promise<DisplayBounds> {
    const raw = await runCommand('system_profiler', ['SPDisplaysDataType']);
    const match = raw.match(/Resolution:\s+(\d+)\s+x\s+(\d+)/i);
    if (!match) {
      throw new PlatformCommandError('Could not determine macOS display size from system_profiler output.');
    }

    return {
      id: 'primary',
      width: Number(match[1]),
      height: Number(match[2]),
      originX: 0,
      originY: 0,
      scaleFactor: 1
    };
  }

  public async execute(action: ScreenAction): Promise<ActionExecutionResult> {
    switch (action.action) {
      case 'screenshot':
        await this.captureScreenshot();
        return { success: true, message: 'Captured screenshot.' };
      case 'wait':
        await new Promise((resolve) => setTimeout(resolve, action.duration * 1000));
        return { success: true, message: `Waited ${action.duration} seconds.` };
      case 'type':
        await runCommand('osascript', ['-e', `tell application "System Events" to keystroke ${toAppleScriptString(action.text)}`]);
        return { success: true, message: `Typed ${action.text.length} characters.` };
      case 'key':
        await runCommand('osascript', ['-e', buildAppleScriptKey(action.text)]);
        return { success: true, message: `Sent key chord ${action.text}.` };
      default:
        await this.ensureCliclick();
        await runCommand('cliclick', toCliclickArguments(action));
        return { success: true, message: `Executed ${action.action}.` };
    }
  }

  private async ensureCliclick(): Promise<void> {
    if (!(await commandExists('cliclick'))) {
      throw new PlatformCommandError(
        'macOS pointer control currently requires cliclick. Install it with "brew install cliclick".'
      );
    }
  }
}

function toAppleScriptString(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function buildAppleScriptKey(chord: string): string {
  const parts = chord.toLowerCase().split('+').map((entry) => entry.trim()).filter(Boolean);
  const key = parts.at(-1);
  if (!key) {
    throw new PlatformCommandError(`Invalid key chord ${chord}.`);
  }

  const modifiers = parts
    .slice(0, -1)
    .map((part) => {
      switch (part) {
        case 'ctrl':
        case 'control':
          return 'control down';
        case 'shift':
          return 'shift down';
        case 'alt':
          return 'option down';
        case 'cmd':
        case 'command':
          return 'command down';
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join(', ');

  const usingClause = modifiers.length > 0 ? ` using {${modifiers}}` : '';
  return `tell application "System Events" to keystroke "${key}"${usingClause}`;
}

function toCliclickArguments(action: ScreenAction): string[] {
  switch (action.action) {
    case 'mouse_move':
      return [`m:${action.coordinate[0]},${action.coordinate[1]}`];
    case 'left_click':
      return [`c:${action.coordinate[0]},${action.coordinate[1]}`];
    case 'right_click':
      return [`rc:${action.coordinate[0]},${action.coordinate[1]}`];
    case 'double_click':
      return [`dc:${action.coordinate[0]},${action.coordinate[1]}`];
    case 'middle_click':
      return [`mc:${action.coordinate[0]},${action.coordinate[1]}`];
    case 'left_click_drag':
      return [
        `m:${action.startCoordinate[0]},${action.startCoordinate[1]}`,
        'dd:.',
        `m:${action.coordinate[0]},${action.coordinate[1]}`,
        'du:.'
      ];
    case 'scroll':
      return [`m:${action.coordinate[0]},${action.coordinate[1]}`, action.direction === 'up' ? 'wu:1' : 'wd:1'];
    default:
      throw new PlatformCommandError(`Unsupported macOS pointer action ${action.action}.`);
  }
}

