import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ActionExecutionResult, ComputerController, DisplayBounds, ScreenAction, ScreenshotArtifact } from '@aria/types';

import { PlatformCommandError } from '../errors.js';
import { commandExists, runCommand } from '../process.js';

export class LinuxComputerPlatform implements ComputerController {
  public async captureScreenshot(): Promise<ScreenshotArtifact> {
    const directory = await mkdtemp(join(tmpdir(), 'aria-linux-shot-'));
    const filePath = join(directory, 'screen.png');

    if (await commandExists('grim')) {
      await runCommand('grim', [filePath]);
    } else if (await commandExists('import')) {
      await runCommand('import', ['-window', 'root', filePath]);
    } else {
      throw new PlatformCommandError('Linux screenshot capture requires either "grim" or ImageMagick "import".');
    }

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
    const raw = await runCommand('xdpyinfo', []);
    const match = raw.match(/dimensions:\s+(\d+)x(\d+)/i);
    if (!match) {
      throw new PlatformCommandError('Could not determine Linux display size from xdpyinfo output.');
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
    if (!(await commandExists('xdotool')) && action.action !== 'wait' && action.action !== 'screenshot') {
      throw new PlatformCommandError('Linux input control requires xdotool to be installed.');
    }

    switch (action.action) {
      case 'screenshot':
        await this.captureScreenshot();
        return { success: true, message: 'Captured screenshot.' };
      case 'wait':
        await new Promise((resolve) => setTimeout(resolve, action.duration * 1000));
        return { success: true, message: `Waited ${action.duration} seconds.` };
      case 'mouse_move':
        await runCommand('xdotool', ['mousemove', `${action.coordinate[0]}`, `${action.coordinate[1]}`]);
        return { success: true, message: `Moved mouse to ${action.coordinate.join(', ')}.` };
      case 'left_click':
        await runCommand('xdotool', ['mousemove', `${action.coordinate[0]}`, `${action.coordinate[1]}`, 'click', '1']);
        return { success: true, message: `Left-clicked at ${action.coordinate.join(', ')}.` };
      case 'right_click':
        await runCommand('xdotool', ['mousemove', `${action.coordinate[0]}`, `${action.coordinate[1]}`, 'click', '3']);
        return { success: true, message: `Right-clicked at ${action.coordinate.join(', ')}.` };
      case 'middle_click':
        await runCommand('xdotool', ['mousemove', `${action.coordinate[0]}`, `${action.coordinate[1]}`, 'click', '2']);
        return { success: true, message: `Middle-clicked at ${action.coordinate.join(', ')}.` };
      case 'double_click':
        await runCommand('xdotool', ['mousemove', `${action.coordinate[0]}`, `${action.coordinate[1]}`, 'click', '--repeat', '2', '1']);
        return { success: true, message: `Double-clicked at ${action.coordinate.join(', ')}.` };
      case 'left_click_drag':
        await runCommand('xdotool', [
          'mousemove',
          `${action.startCoordinate[0]}`,
          `${action.startCoordinate[1]}`,
          'mousedown',
          '1',
          'mousemove',
          `${action.coordinate[0]}`,
          `${action.coordinate[1]}`,
          'mouseup',
          '1'
        ]);
        return {
          success: true,
          message: `Dragged from ${action.startCoordinate.join(', ')} to ${action.coordinate.join(', ')}.`
        };
      case 'type':
        await runCommand('xdotool', ['type', '--delay', '10', '--', action.text]);
        return { success: true, message: `Typed ${action.text.length} characters.` };
      case 'key':
        await runCommand('xdotool', ['key', action.text.replaceAll('+', '+')]);
        return { success: true, message: `Sent key chord ${action.text}.` };
      case 'scroll':
        await runCommand('xdotool', [
          'mousemove',
          `${action.coordinate[0]}`,
          `${action.coordinate[1]}`,
          'click',
          '--repeat',
          `${Math.max(1, Math.round(action.amount / 120))}`,
          action.direction === 'up' ? '4' : '5'
        ]);
        return { success: true, message: `Scrolled ${action.direction} by ${action.amount}.` };
      default:
        throw new PlatformCommandError(`Unsupported Linux action ${(action as ScreenAction).action}.`);
    }
  }
}

