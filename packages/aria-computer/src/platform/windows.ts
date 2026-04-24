import { randomUUID } from 'node:crypto';

import type { ActionExecutionResult, ComputerController, DisplayBounds, ScreenAction, ScreenshotArtifact } from '@ariacore/types';

import { PlatformCommandError } from '../errors.js';
import { runPowerShellScript } from '../process.js';

const mouseInterop = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeMouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
}
"@
`;

const keyMap: Record<string, string> = {
  enter: '~',
  tab: '{TAB}',
  esc: '{ESC}',
  escape: '{ESC}',
  backspace: '{BACKSPACE}',
  delete: '{DELETE}',
  up: '{UP}',
  down: '{DOWN}',
  left: '{LEFT}',
  right: '{RIGHT}',
  home: '{HOME}',
  end: '{END}',
  pageup: '{PGUP}',
  pagedown: '{PGDN}',
  space: ' '
};

interface PowerShellScreenshotPayload {
  width: number;
  height: number;
  imageBase64: string;
}

interface PowerShellDisplayPayload {
  width: number;
  height: number;
  originX: number;
  originY: number;
}

export class WindowsComputerPlatform implements ComputerController {
  public async captureScreenshot(): Promise<ScreenshotArtifact> {
    const raw = await runPowerShellScript(`
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

try {
  $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
  $stream = New-Object System.IO.MemoryStream
  try {
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    [pscustomobject]@{
      width = $bounds.Width
      height = $bounds.Height
      imageBase64 = [Convert]::ToBase64String($stream.ToArray())
    } | ConvertTo-Json -Compress
  } finally {
    $stream.Dispose()
  }
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}
`);

    const payload = JSON.parse(raw) as PowerShellScreenshotPayload;
    return {
      id: randomUUID(),
      mimeType: 'image/png',
      base64: payload.imageBase64,
      width: payload.width,
      height: payload.height,
      capturedAt: new Date().toISOString()
    };
  }

  public async getDisplayBounds(): Promise<DisplayBounds> {
    const raw = await runPowerShellScript(`
Add-Type -AssemblyName System.Windows.Forms
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
[pscustomobject]@{
  width = $bounds.Width
  height = $bounds.Height
  originX = $bounds.X
  originY = $bounds.Y
} | ConvertTo-Json -Compress
`);

    const payload = JSON.parse(raw) as PowerShellDisplayPayload;
    return {
      id: 'primary',
      width: payload.width,
      height: payload.height,
      originX: payload.originX,
      originY: payload.originY,
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
      case 'mouse_move':
        await this.runMouseScript(`${this.moveMouse(action.coordinate[0], action.coordinate[1])}`);
        return { success: true, message: `Moved mouse to ${action.coordinate.join(', ')}.` };
      case 'left_click':
        await this.runMouseScript(`
${this.moveMouse(action.coordinate[0], action.coordinate[1])}
[NativeMouse]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
[NativeMouse]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
`);
        return { success: true, message: `Left-clicked at ${action.coordinate.join(', ')}.` };
      case 'right_click':
        await this.runMouseScript(`
${this.moveMouse(action.coordinate[0], action.coordinate[1])}
[NativeMouse]::mouse_event(0x0008, 0, 0, 0, [UIntPtr]::Zero)
[NativeMouse]::mouse_event(0x0010, 0, 0, 0, [UIntPtr]::Zero)
`);
        return { success: true, message: `Right-clicked at ${action.coordinate.join(', ')}.` };
      case 'middle_click':
        await this.runMouseScript(`
${this.moveMouse(action.coordinate[0], action.coordinate[1])}
[NativeMouse]::mouse_event(0x0020, 0, 0, 0, [UIntPtr]::Zero)
[NativeMouse]::mouse_event(0x0040, 0, 0, 0, [UIntPtr]::Zero)
`);
        return { success: true, message: `Middle-clicked at ${action.coordinate.join(', ')}.` };
      case 'double_click':
        await this.runMouseScript(`
${this.moveMouse(action.coordinate[0], action.coordinate[1])}
1..2 | ForEach-Object {
  [NativeMouse]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  [NativeMouse]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
}
`);
        return { success: true, message: `Double-clicked at ${action.coordinate.join(', ')}.` };
      case 'left_click_drag':
        await this.runMouseScript(`
${this.moveMouse(action.startCoordinate[0], action.startCoordinate[1])}
[NativeMouse]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 60
${this.moveMouse(action.coordinate[0], action.coordinate[1])}
Start-Sleep -Milliseconds 60
[NativeMouse]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
`);
        return {
          success: true,
          message: `Dragged from ${action.startCoordinate.join(', ')} to ${action.coordinate.join(', ')}.`
        };
      case 'type': {
        const safeText = escapeSendKeysText(action.text).replace(/'/g, "''");
        await this.runKeyScript(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${safeText}')
`);
        return { success: true, message: `Typed ${action.text.length} characters.` };
      }
      case 'key': {
        const safeChord = toSendKeysChord(action.text).replace(/'/g, "''");
        await this.runKeyScript(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${safeChord}')
`);
        return { success: true, message: `Sent key chord ${action.text}.` };
      }
      case 'scroll':
        await this.runMouseScript(`
${this.moveMouse(action.coordinate[0], action.coordinate[1])}
[NativeMouse]::mouse_event(0x0800, 0, 0, ${action.direction === 'up' ? action.amount : -action.amount}, [UIntPtr]::Zero)
`);
        return { success: true, message: `Scrolled ${action.direction} by ${action.amount}.` };
      default:
        throw new PlatformCommandError(`Unsupported Windows action ${(action as ScreenAction).action}.`);
    }
  }

  private async runMouseScript(body: string): Promise<void> {
    await runPowerShellScript(`
${mouseInterop}
${body}
`);
  }

  private async runKeyScript(body: string): Promise<void> {
    await runPowerShellScript(body);
  }

  private moveMouse(x: number, y: number): string {
    return `
[NativeMouse]::SetCursorPos(${Math.round(x)}, ${Math.round(y)}) | Out-Null
Start-Sleep -Milliseconds 40
`;
  }
}

function escapeSendKeysText(value: string): string {
  return value.replaceAll('{', '{{}').replaceAll('}', '{}}').replace(/[+^%~()\[\]]/g, '{$&}');
}

function toSendKeysChord(chord: string): string {
  const parts = chord.toLowerCase().split('+').map((part) => part.trim()).filter(Boolean);
  const modifiers = parts.slice(0, -1).map((part) => {
    switch (part) {
      case 'ctrl':
      case 'control':
        return '^';
      case 'shift':
        return '+';
      case 'alt':
        return '%';
      default:
        return '';
    }
  });

  const mainKey = parts.at(-1);
  if (!mainKey) {
    throw new PlatformCommandError(`Invalid key chord: ${chord}`);
  }

  const mappedMain = keyMap[mainKey] ?? mainKey.toUpperCase();
  return `${modifiers.join('')}${mappedMain}`;
}

