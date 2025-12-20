// AOT Markers - Zero Overhead at Runtime (Standard Decorators)

export function Injectable() {
  return (value: any, context: ClassDecoratorContext) => {
    if (context.kind !== 'class') {
      throw new Error(`@Injectable must be used on a class. Used on: ${context.kind}`);
    }
    return value;
  };
}

export function Controller(_prefix: string = '') {
  return (value: any, context: ClassDecoratorContext) => {
    if (context.kind !== 'class') {
      throw new Error(`@Controller must be used on a class. Used on: ${context.kind}`);
    }
    // Metadata is handled by CLI analysis, but we can hook instance creation here if needed.
    return value;
  };
}

export function Module(_metadata: any) {
  return (value: any, context: ClassDecoratorContext) => {
    if (context.kind !== 'class') {
      throw new Error(`@Module must be used on a class. Used on: ${context.kind}`);
    }
    return value;
  };
}

export function RootModule(_metadata: any) {
  return (value: any, context: ClassDecoratorContext) => {
    if (context.kind !== 'class') {
      throw new Error(`@RootModule must be used on a class. Used on: ${context.kind}`);
    }
    return value;
  };
}
