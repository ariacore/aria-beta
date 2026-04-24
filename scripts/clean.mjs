import { rm } from 'node:fs/promises';

const targets = ['dist', '.turbo', 'coverage'];

await Promise.all(
  targets.map(async (target) => {
    await rm(new URL(`../${target}`, import.meta.url), {
      force: true,
      recursive: true
    });
  })
);

