function registerParamMetadata(
  target: any,
  propertyKey: string | symbol | undefined,
  parameterIndex: number,
  decoratorName: string,
  args: any[],
) {
  // Only handle constructor parameters for now (DI)
  if (propertyKey !== undefined) {
    return;
  }

  const globalRef = globalThis as any;
  if (!globalRef.__BUNNER_METADATA_REGISTRY__) {
    globalRef.__BUNNER_METADATA_REGISTRY__ = new Map();
  }
  const registry = globalRef.__BUNNER_METADATA_REGISTRY__;

  // target is the Constructor for constructor parameters
  let meta = registry.get(target);
  if (!meta) {
    meta = { decorators: [], constructorParams: [] };
    registry.set(target, meta);
  }

  if (!meta.constructorParams[parameterIndex]) {
    meta.constructorParams[parameterIndex] = { decorators: [] };
  }
  if (!meta.constructorParams[parameterIndex].decorators) {
    meta.constructorParams[parameterIndex].decorators = [];
  }

  meta.constructorParams[parameterIndex].decorators.push({
    name: decoratorName,
    arguments: args,
  });
}

export function Inject(token: any) {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex?: number) => {
    if (typeof parameterIndex === 'number') {
      registerParamMetadata(target as any, propertyKey, parameterIndex, 'Inject', [token]);
    }
  };
}

export function Optional() {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex?: number) => {
    if (typeof parameterIndex === 'number') {
      registerParamMetadata(target as any, propertyKey, parameterIndex, 'Optional', []);
    }
  };
}
