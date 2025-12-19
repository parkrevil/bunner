function createHttpParamDecorator() {
  return function (_target: object, _propertyKey: string | symbol | undefined, _index: number) {};
}

export const Body = () => createHttpParamDecorator();
export const Query = () => createHttpParamDecorator();
export const Params = () => createHttpParamDecorator();
export const Request = () => createHttpParamDecorator();
export const Response = () => createHttpParamDecorator();
export const Cookie = () => createHttpParamDecorator();
export const Ip = () => createHttpParamDecorator();
