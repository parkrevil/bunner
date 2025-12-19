function createHttpParamDecorator() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function (target: object, propertyKey: string | symbol | undefined, index: number) {};
}

export const Body = () => createHttpParamDecorator();
export const Query = () => createHttpParamDecorator();
export const Params = () => createHttpParamDecorator();
export const Request = () => createHttpParamDecorator();
export const Response = () => createHttpParamDecorator();
export const Cookie = () => createHttpParamDecorator();
export const Ip = () => createHttpParamDecorator();
