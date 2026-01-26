export class BunnerContextError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'BunnerContextError';
  }
}
