import { WindowsComputerPlatform } from './packages/aria-computer/src/platform/windows.js';

async function main() {
  const platform = new WindowsComputerPlatform();
  console.log('Testing Windows Computer Platform Input...');
  
  // 1. Move mouse to center
  console.log('Moving mouse to 500, 500');
  await platform.execute({ action: 'mouse_move', coordinate: [500, 500] });
  await new Promise((r) => setTimeout(r, 1000));
  
  // 2. Click
  console.log('Left clicking');
  await platform.execute({ action: 'left_click', coordinate: [500, 500] });
  await new Promise((r) => setTimeout(r, 1000));
  
  // 3. Type text
  console.log('Typing Hello');
  await platform.execute({ action: 'type', text: 'Hello' });
  await new Promise((r) => setTimeout(r, 1000));
  
  // 4. Send Key
  console.log('Pressing Enter');
  await platform.execute({ action: 'key', text: 'enter' });
  
  console.log('Done testing!');
}

main().catch(console.error);
