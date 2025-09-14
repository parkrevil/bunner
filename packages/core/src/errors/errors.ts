/**
 * Bunner Error
 * @description The base Bunner error
 */
export class BunnerError extends Error {
  constructor(message: string) {
    super(message);
  }
}
