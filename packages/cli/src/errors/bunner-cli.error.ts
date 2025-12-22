export class BunnerCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BunnerCliError';
  }
}
