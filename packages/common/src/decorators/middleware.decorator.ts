import type { MiddlewareRegistration, MiddlewareToken } from '../interfaces';

export function Middleware(): ClassDecorator {
  return () => {};
}

export function UseMiddlewares(
  ..._middlewares: Array<MiddlewareToken | MiddlewareRegistration>
): MethodDecorator & ClassDecorator {
  return () => {};
}
