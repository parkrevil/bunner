export const Body =
  (_property?: string): ParameterDecorator =>
  () => {};
export const Query =
  (_property?: string): ParameterDecorator =>
  () => {};
export const Params =
  (_property?: string): ParameterDecorator =>
  () => {};
export const Param = Params;
export const Request = (): ParameterDecorator => () => {};
export const Req = Request;
export const Response = (): ParameterDecorator => () => {};
export const Res = Response;
export const Cookie =
  (_property?: string): ParameterDecorator =>
  () => {};
export const Ip = (): ParameterDecorator => () => {};
