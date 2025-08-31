/**
 * Params Decorator
 * @param name - Parameter name
 * @returns ParameterDecorator
 */
export function Params(): ParameterDecorator {
  return function(target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) {
    console.log('📦 Params Decorator', parameterIndex);
  };
}

/**
 * Body Decorator
 * @returns ParameterDecorator
 */
export function Body(): ParameterDecorator {
  return function(target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) {
    console.log('📦 Body Decorator', parameterIndex);
  };
}

/**
 * Query Decorator
 * @param name - Parameter name
 * @returns ParameterDecorator
 */
export function Query(name?: string): ParameterDecorator {
  return function(target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) {
    console.log('📦 Query Decorator', parameterIndex);
  };
}