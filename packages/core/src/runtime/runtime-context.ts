import type { RuntimeContext } from './interfaces';

let runtimeContext: RuntimeContext = {};

export function registerRuntimeContext(context: RuntimeContext): void {
  const nextContext: RuntimeContext = {};

  if (context.metadataRegistry !== undefined) {
    nextContext.metadataRegistry = context.metadataRegistry;
  } else if (runtimeContext.metadataRegistry !== undefined) {
    nextContext.metadataRegistry = runtimeContext.metadataRegistry;
  }

  if (context.scopedKeys !== undefined) {
    nextContext.scopedKeys = context.scopedKeys;
  } else if (runtimeContext.scopedKeys !== undefined) {
    nextContext.scopedKeys = runtimeContext.scopedKeys;
  }

  if (context.container !== undefined) {
    nextContext.container = context.container;
  } else if (runtimeContext.container !== undefined) {
    nextContext.container = runtimeContext.container;
  }

  if (context.isAotRuntime !== undefined) {
    nextContext.isAotRuntime = context.isAotRuntime;
  } else if (runtimeContext.isAotRuntime !== undefined) {
    nextContext.isAotRuntime = runtimeContext.isAotRuntime;
  }

  runtimeContext = nextContext;
}

export function getRuntimeContext(): RuntimeContext {
  return runtimeContext;
}
