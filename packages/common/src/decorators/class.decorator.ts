import 'reflect-metadata';

// Helper to register metadata in global registry
// This is required because our Core Scanner relies on this specific registry
// rather than scanning standard Reflect keys directly everywhere.
function registerMetadata(target: any, decoratorName: string, args: any[]) {
  const globalRef = globalThis as any;
  if (!globalRef.__BUNNER_METADATA_REGISTRY__) {
    globalRef.__BUNNER_METADATA_REGISTRY__ = new Map();
  }
  const registry = globalRef.__BUNNER_METADATA_REGISTRY__;

  let meta = registry.get(target);
  if (!meta) {
    meta = { decorators: [], constructorParams: [] };
    registry.set(target, meta);
  }

  // Capture constructor params via Reflection
  const paramTypes = Reflect.getMetadata('design:paramtypes', target);
  if (paramTypes) {
    // Merge with existing params (e.g. from @Inject)
    meta.constructorParams = meta.constructorParams || [];
    paramTypes.forEach((type: any, index: number) => {
      if (!meta.constructorParams[index]) {
        meta.constructorParams[index] = {};
      }
      meta.constructorParams[index].type = type;
    });
  }

  meta.decorators.push({
    name: decoratorName,
    arguments: args,
  });
}

export function Injectable() {
  return (target: Function) => {
    registerMetadata(target, 'Injectable', []);
  };
}

export function Controller(prefix: string = '') {
  return (target: Function) => {
    registerMetadata(target, 'Controller', [prefix]);
  };
}

export function Module(metadata: any) {
  return (target: Function) => {
    registerMetadata(target, 'Module', [metadata]);
  };
}
