export interface RuntimeContext {
  metadataRegistry?: Map<any, any>;
  scopedKeys?: Map<any, string>;
  container?: unknown;
  isAotRuntime?: boolean;
}
