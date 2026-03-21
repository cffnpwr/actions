export class ProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown; }) {
    super(message, options);
    this.name = "ProviderError";
  }
}
