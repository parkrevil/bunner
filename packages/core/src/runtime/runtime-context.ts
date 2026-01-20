import type { RuntimeContext } from './interfaces';

let runtimeContext: RuntimeContext = {};

export function registerRuntimeContext(context: RuntimeContext): void {
  runtimeContext = {
    metadataRegistry: context.metadataRegistry ?? runtimeContext.metadataRegistry,
    scopedKeys: context.scopedKeys ?? runtimeContext.scopedKeys,
    container: context.container ?? runtimeContext.container,
    isAotRuntime: context.isAotRuntime ?? runtimeContext.isAotRuntime,
  };
}

export function getRuntimeContext(): RuntimeContext {
  return runtimeContext;
}
