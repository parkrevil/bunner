import type { HttpMethodDecoratorOptions } from './interfaces';

function createHttpMethodDecorator(method: string) {
  return function (pathOrOptions?: string | HttpMethodDecoratorOptions, options?: HttpMethodDecoratorOptions) {
    let path = '/';
    let finalOptions: HttpMethodDecoratorOptions = {};

    if (typeof pathOrOptions === 'string') {
      path = pathOrOptions;
      if (options) {
        finalOptions = options;
      }
    } else if (pathOrOptions) {
      finalOptions = pathOrOptions;
      if (finalOptions.path) {
        path = finalOptions.path;
      }
    }

    return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
      const globalRef = globalThis as any;
      if (!globalRef.__BUNNER_METADATA_REGISTRY__) {
        globalRef.__BUNNER_METADATA_REGISTRY__ = new Map();
      }
      const registry = globalRef.__BUNNER_METADATA_REGISTRY__;

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

      methodMeta.decorators.push({
        name: method,
        arguments: [path, finalOptions],
      });
    };
  };
}

export const Get = createHttpMethodDecorator('Get');
export const Post = createHttpMethodDecorator('Post');
export const Put = createHttpMethodDecorator('Put');
export const Delete = createHttpMethodDecorator('Delete');
export const Patch = createHttpMethodDecorator('Patch');
export const Options = createHttpMethodDecorator('Options');
export const Head = createHttpMethodDecorator('Head');
