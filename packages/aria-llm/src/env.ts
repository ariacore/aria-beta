export function requireEnv(variableName: string, provider: string): string {
  const value = process.env[variableName];
  if (!value) {
    throw new Error(`Provider "${provider}" requires env var ${variableName}.`);
  }

  return value;
}

