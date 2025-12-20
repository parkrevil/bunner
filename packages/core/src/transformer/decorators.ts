export function Hidden() {
  return function (_target: object, _propertyKey: string | symbol) {};
}

export function Transform(_transformFn: (params: { value: any; key: string; obj: any; type: any }) => any) {
  return function (_target: object, _propertyKey: string | symbol) {};
}
