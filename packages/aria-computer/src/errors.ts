export class PlatformCommandError extends Error {
  public constructor(
    message: string,
    public readonly details?: string
  ) {
    super(message);
    this.name = 'PlatformCommandError';
  }
}

