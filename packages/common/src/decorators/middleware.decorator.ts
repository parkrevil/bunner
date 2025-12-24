export function Middleware(): ClassDecorator {
  return () => {};
}

export function UseMiddlewares(..._middlewares: any[]): MethodDecorator & ClassDecorator {
  return () => {};
}
