/**
 * CLI-scoped error type.
 *
 * @param message Error message.
 */
export class BunnerCliError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'BunnerCliError';
  }
}
