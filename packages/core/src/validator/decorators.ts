import type { PrimitiveArray } from '@bunner/common';

import type { ValidatorOptions } from './interfaces';
import type { ValidatorDecoratorArgs, ValidatorDecoratorTarget, ValidatorPropertyDecorator } from './types';

function createDecorator(
  decoratorName: string,
  decoratorArgs: ValidatorDecoratorArgs = [],
  decoratorOptions?: ValidatorOptions,
): ValidatorPropertyDecorator {
  void decoratorName;
  void decoratorArgs;

  const options = decoratorOptions ?? {};

  void options;

  return function (target: ValidatorDecoratorTarget, propertyKey: string | symbol) {
    void target;
    void propertyKey;
  };
}

export function IsString(options?: ValidatorOptions) {
  return createDecorator('IsString', [], options);
}

export function IsNumber(options?: ValidatorOptions) {
  return createDecorator('IsNumber', [], options);
}

export function IsInt(options?: ValidatorOptions) {
  return createDecorator('IsInt', [], options);
}

export function IsBoolean(options?: ValidatorOptions) {
  return createDecorator('IsBoolean', [], options);
}

export function IsArray(options?: ValidatorOptions) {
  return createDecorator('IsArray', [], options);
}

export function IsOptional(options?: ValidatorOptions) {
  return createDecorator('IsOptional', [], options);
}

export function IsIn(values: PrimitiveArray, options?: ValidatorOptions) {
  return createDecorator('IsIn', [values], options);
}

export function Min(min: number, options?: ValidatorOptions) {
  return createDecorator('Min', [min], options);
}

export function Max(max: number, options?: ValidatorOptions) {
  return createDecorator('Max', [max], options);
}

export function ValidateNested(options?: ValidatorOptions) {
  return createDecorator('ValidateNested', [], options);
}
