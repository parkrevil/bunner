import 'reflect-metadata';

function registerHttpParam(target: object, propertyKey: string | symbol, parameterIndex: number, type: string, args: any[]) {
  const globalRef = globalThis as any;
  if (!globalRef.__BUNNER_METADATA_REGISTRY__) {
    globalRef.__BUNNER_METADATA_REGISTRY__ = new Map();
  }
  const registry = globalRef.__BUNNER_METADATA_REGISTRY__;

  // target is the prototype, so we need target.constructor
  const constructor = target.constructor;
  let meta = registry.get(constructor);
  if (!meta) {
    meta = { decorators: [], constructorParams: [], methods: new Map() };
    registry.set(constructor, meta);
  }
  if (!meta.methods) {
    meta.methods = new Map();
  }

  let methodMeta = meta.methods.get(propertyKey);
  if (!methodMeta) {
    methodMeta = {
      name: propertyKey,
      decorators: [],
      parameters: [],
    };
    meta.methods.set(propertyKey, methodMeta);
  }
  if (!methodMeta.parameters) {
    methodMeta.parameters = [];
  }

  // Capture actual param type from Reflection
  const paramTypes = Reflect.getMetadata('design:paramtypes', target, propertyKey);
  let metatype = undefined;
  if (paramTypes && paramTypes[parameterIndex]) {
    metatype = paramTypes[parameterIndex].name;
  }

  // Check if param object exists, if not create basic structure
  if (!methodMeta.parameters[parameterIndex]) {
    methodMeta.parameters[parameterIndex] = {
      index: parameterIndex,
      type: metatype, // Store the actual type (e.g. 'String', 'CreateUserDto')
      decorators: [],
    };
  } else if (!methodMeta.parameters[parameterIndex].type) {
    methodMeta.parameters[parameterIndex].type = metatype;
  }

  // Push this specific decorator to the decorators array
  methodMeta.parameters[parameterIndex].decorators.push({
    name: type, // 'Body', 'Param', etc.
    arguments: args,
  });
}

export const Body = (property?: string) => (target: object, propertyKey: string | symbol, parameterIndex: number) =>
  registerHttpParam(target, propertyKey, parameterIndex, 'Body', [property]);
export const Query = (property?: string) => (target: object, propertyKey: string | symbol, parameterIndex: number) =>
  registerHttpParam(target, propertyKey, parameterIndex, 'Query', [property]);
export const Params = (property?: string) => (target: object, propertyKey: string | symbol, parameterIndex: number) =>
  registerHttpParam(target, propertyKey, parameterIndex, 'Param', [property]);
export const Param = Params;
export const Request = () => (target: object, propertyKey: string | symbol, parameterIndex: number) =>
  registerHttpParam(target, propertyKey, parameterIndex, 'Request', []);
export const Req = Request;
export const Response = () => (target: object, propertyKey: string | symbol, parameterIndex: number) =>
  registerHttpParam(target, propertyKey, parameterIndex, 'Response', []);
export const Res = Response;
export const Cookie = (property?: string) => (target: object, propertyKey: string | symbol, parameterIndex: number) =>
  registerHttpParam(target, propertyKey, parameterIndex, 'Cookie', [property]);
export const Ip = () => (target: object, propertyKey: string | symbol, parameterIndex: number) =>
  registerHttpParam(target, propertyKey, parameterIndex, 'Ip', []);
