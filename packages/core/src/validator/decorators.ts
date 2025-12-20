import { MetadataStorage } from '../metadata/metadata-storage';

export type ValidatorOptions = {
  message?: string;
  each?: boolean;
};

export function Transform(transformFn: (params: { value: any, key: string, obj: any, type: any }) => any) {
  return function (_: undefined, context: ClassFieldDecoratorContext) {
    if (context && context.kind !== 'field') {
      throw new Error(`@Transform must be used on a field. Used on: ${context.kind}`);
    }
    MetadataStorage.addDecoratorMetadata(context, {
      name: 'Transform',
      arguments: [transformFn],
      options: {},
    });
  };
}

// Generic helper for standard decorators
function createDecorator(name: string, args: any[] = [], options: any = {}) {
  return function (_: undefined, context: ClassFieldDecoratorContext) {
    if (context && context.kind !== 'field') {
      throw new Error(`@${name} must be used on a field. Used on: ${context.kind}`);
    }
    MetadataStorage.addDecoratorMetadata(context, {
      name,
      arguments: args,
      options,
    });
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

export function IsIn(values: any[], options?: ValidatorOptions) {
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
