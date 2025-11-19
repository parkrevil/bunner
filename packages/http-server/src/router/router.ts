import { RadixRouterBuilder } from './builder/radix-router-builder';
import { RadixRouterInstance } from './instance/radix-router-instance';

export { RadixRouterCore } from './core/radix-router-core';
export { RadixRouterInstance } from './instance/radix-router-instance';
export { RadixRouterBuilder } from './builder/radix-router-builder';

export const RadixRouter = RadixRouterBuilder;
export type RadixRouter = RadixRouterInstance;

export default RadixRouterBuilder;
