import type { AriaConfig } from '@ariacore/types';

interface TelegramMessageResponse {
  ok: boolean;
  description?: string;
}

export class TelegramTransport {
  public constructor(private readonly config: AriaConfig) {}

  public isEnabled(): boolean {
    return this.config.delivery.telegram.enabled;
  }

  public async sendMessage(text: string): Promise<void> {
    const token = process.env[this.config.delivery.telegram.botTokenEnv];
    const chatId = process.env[this.config.delivery.telegram.chatIdEnv];

    if (!this.isEnabled()) {
      return;
    }

    if (!token || !chatId) {
      throw new Error(
        `Telegram delivery is enabled but env vars ${this.config.delivery.telegram.botTokenEnv} or ${this.config.delivery.telegram.chatIdEnv} are missing.`
      );
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });

    const payload = (await response.json()) as TelegramMessageResponse;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.description ?? `Telegram sendMessage failed with status ${response.status}.`);
    }
  }

  public async startPolling(onMessage: (text: string, messageId: number) => Promise<void>): Promise<void> {
    const token = process.env[this.config.delivery.telegram.botTokenEnv];
    if (!token || !this.isEnabled()) return;
    
    let offset = 0;
    
    console.log('Started Telegram inbound listener...');
    
    while (true) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=30`);
        const payload = await response.json();
        
        if (payload.ok && payload.result.length > 0) {
           for (const update of payload.result) {
              offset = update.update_id + 1;
              if (update.message?.text) {
                 await onMessage(update.message.text, update.message.message_id);
              }
           }
        }
      } catch (err) {
         // Silently ignore network errors during polling
         await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
}
