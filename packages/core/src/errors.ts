export class EmitDecoratorMetadataError extends Error {
  constructor() {
    super("Ensure 'emitDecoratorMetadata' is enabled in your tsconfig.json");
  }
}
