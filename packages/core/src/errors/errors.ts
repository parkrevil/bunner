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
 * Emit Decorator Metadata Error
 * @description The error thrown when 'emitDecoratorMetadata' is not enabled in tsconfig.json
 */
export class EmitDecoratorMetadataError extends Error {
  constructor() {
    super("Ensure 'emitDecoratorMetadata' is enabled in your tsconfig.json");
  }
}
