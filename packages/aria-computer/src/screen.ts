import type { ComputerController } from '@ariacore/types';

import { LinuxComputerPlatform } from './platform/linux.js';
import { MacOsComputerPlatform } from './platform/macos.js';
import { WindowsComputerPlatform } from './platform/windows.js';

export function createComputerController(): ComputerController {
  switch (process.platform) {
    case 'win32':
      return new WindowsComputerPlatform();
    case 'linux':
      return new LinuxComputerPlatform();
    case 'darwin':
      return new MacOsComputerPlatform();
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

