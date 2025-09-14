import { BunnerError } from '../errors';

/**
 * Bunner Rust Error
 * @description The error thrown when a Rust FFI call fails
 */
export class RustError extends BunnerError {
  readonly detail: any;

  constructor(message: string, detail?: any) {
    super(message);

    this.detail = detail;
  }
}
