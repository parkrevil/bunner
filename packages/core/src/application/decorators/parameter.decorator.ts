// AOT Markers - Zero Overhead

export function Inject(_token: any): ParameterDecorator {
  return (_target: any, _propertyKey: string | symbol | undefined, _parameterIndex: number) => {};
}

export function Optional(): ParameterDecorator {
  return (_target: object, _propertyKey: string | symbol | undefined, _parameterIndex: number) => {};
}
