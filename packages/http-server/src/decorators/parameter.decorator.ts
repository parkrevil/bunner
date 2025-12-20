export const Body =
  (_property?: string, ..._pipes: any[]) =>
  (_target: object, _propertyKey: string | symbol, _parameterIndex: number) => {};
export const Query =
  (_property?: string, ..._pipes: any[]) =>
  (_target: object, _propertyKey: string | symbol, _parameterIndex: number) => {};
export const Params =
  (_property?: string, ..._pipes: any[]) =>
  (_target: object, _propertyKey: string | symbol, _parameterIndex: number) => {};
export const Param = Params;
export const Request = () => (_target: object, _propertyKey: string | symbol, _parameterIndex: number) => {};
export const Req = Request;
export const Response = () => (_target: object, _propertyKey: string | symbol, _parameterIndex: number) => {};
export const Res = Response;
export const Cookie = (_property?: string) => (_target: object, _propertyKey: string | symbol, _parameterIndex: number) => {};
export const Ip = () => (_target: object, _propertyKey: string | symbol, _parameterIndex: number) => {};
