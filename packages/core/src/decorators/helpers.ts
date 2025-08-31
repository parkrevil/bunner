import { PARAM_METADATA_KEY } from './constants';

export function createParamDecorator(type: string, token?: string): ParameterDecorator {
  return function(target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    if (!target.constructor[PARAM_METADATA_KEY]) {
      target.constructor[PARAM_METADATA_KEY] = {};
    }

    const paramsForMethod = target.constructor[PARAM_METADATA_KEY][propertyKey as string] ?? [];
    paramsForMethod.push({ index: parameterIndex, type, token });

    target.constructor[PARAM_METADATA_KEY][propertyKey as string] = paramsForMethod;
  };
}
