/**
 * Bunner Error
 * @description The base Bunner error
 */
export class BunnerError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Bunner Rust Error
 * @description The error thrown when a Rust FFI call fails
 */
export class BunnerRustError extends Error {
  readonly detail: any;

  constructor(message: string, detail?: any) {
    super(message);

    this.detail = detail;
  }
}

/**
 * Emit Decorator Metadata Error
 * @description The error thrown when 'emitDecoratorMetadata' is not enabled in tsconfig.json
 */
export class EmitDecoratorMetadataError extends Error {
  constructor() {
    super("Ensure 'emitDecoratorMetadata' is enabled in your tsconfig.json");
  }
}
