import type { RestControllerDecoratorOptions } from './interfaces';

export function RestController(_path?: string, _options?: RestControllerDecoratorOptions) {
  return (value: any, context: ClassDecoratorContext) => {
    if (context.kind !== 'class') {
      throw new Error(`@RestController must be used on a class. Used on: ${context.kind}`);
    }
    return value;
  };
}
