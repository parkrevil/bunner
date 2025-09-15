import { BunnerError } from '../errors';

/**
 * Bunner FFI Error
 * @description The error class for FFI errors
 */
export class BunnerFfiError extends BunnerError {
  readonly detail: any;

  constructor(message: string, detail?: any) {
    super(message);

    this.detail = detail;
  }
}
