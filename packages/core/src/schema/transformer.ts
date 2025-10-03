import { SchemaManager } from './preprocessor';

export class Transformer {
  private schemaManager: SchemaManager;

  constructor() {
    this.schemaManager = new SchemaManager();
  }

  toInstance() {}

  toPlain() {
    // Default expose all properties
  }
}
