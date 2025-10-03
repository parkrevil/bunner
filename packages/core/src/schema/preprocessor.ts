export class SchemaManager {
  private schemas: Map<Function, any>;

  constructor() {
    this.schemas = new Map();
  }

  build() {
    // Read reflect-metadata and build schemas
    // This will involve iterating over all classes and their properties
    // to construct the schema definitions.
    // With validation rules, transformation functions, etc.
  }

  get(cls: Function): any {
    return this.schemas.get(cls);
  }

  toJSON() {
    //
  }
}
