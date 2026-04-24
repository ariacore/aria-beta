import type { AriaLogger } from '@aria/types';

export async function postJson<TResponse>(
  url: string,
  init: {
    headers?: Record<string, string>;
    body: unknown;
  },
  logger: AriaLogger
): Promise<TResponse> {
  logger.debug('Sending provider request.', { url });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {})
    },
    body: JSON.stringify(init.body)
  });

  if (!response.ok) {
    throw new Error(`Provider request failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as TResponse;
}

