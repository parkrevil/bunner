import { MetadataConsumer } from '../metadata/metadata-consumer';

export class TransformerCompiler {
  private static p2iCache = new Map<Function, Function>();
  private static i2pCache = new Map<Function, Function>();

  /**
   * Compiles plainToInstance function
   */
  static compilePlainToInstance(target: Function): (plain: any) => any {
    if (this.p2iCache.has(target)) {
      return this.p2iCache.get(target) as any;
    }

    const metadata = MetadataConsumer.getCombinedMetadata(target);

    // We assume 'target' constructor is available in scope or we use 'new target()' if we could pass it.
    // 'new Function' cannot access outer scope 'target'.
    // So we return a closure.

    // Strategy: generate the body, then wrap.
    /*
      const instance = new Target();
      if (plain.name !== undefined) instance.name = String(plain.name);
      if (plain.age !== undefined) instance.age = Number(plain.age);
      return instance;
    */

    const bodyLines: string[] = [];
    bodyLines.push('const instance = new Target();'); // Target will be passed as arg
    bodyLines.push("if (!plain || typeof plain !== 'object') return instance;");

    for (const [propName, prop] of Object.entries(metadata.properties)) {
      const p = prop as any;
      const access = `plain['${propName}']`;

      // Determine conversion strategy based on Type
      // p.type is the Constructor Reference (if provided by CLI) or String
      // But in 'new Function', we can't easily reference external Constructors unless passed in 'context'.

      // Core Logic:
      // We will generate a function: (plain, Target, Converters) => instance

      // Check for @Transform
      const transformDec = p.decorators.find((d: any) => d.name === 'Transform');

      bodyLines.push(`if (${access} !== undefined) {`);

      if (transformDec) {
        // Use custom transformer
        // We stored the function in arguments[0] of decorator
        // In serialized CLI metadata, arguments might be serialized?
        // Ah, @Transform contains a FUNCTION. MetadataRegistry from CLI stores SERIALIZED metadata.
        // Functions cannot be JSON.stringified.
        // Wait, AST Parser extracted 'factoryCode' string.
        // But Runtime @Transform puts actual Function in memory.

        // MetadataConsumer merges them. Runtime decorator wins.
        // So we have the function in memory.
        // Index it?
        // Complex to embed function into string.
        // Alternative: The compiled function calls a helper `executeTransform(target, key, plain, ...)`?

        // For JIT simplicity, let's assume standard primitives for now.
        // @Transform is advanced.

        bodyLines.push(`  instance['${propName}'] = ${access};`); // Fallback
      } else {
        // Standard Type Conversion
        // How to know if p.type is Number constructor or String "number"?
        // MetadataConsumer normalizes?

        // If p.type is a Class Constructor (from CLI injection)
        // We can check `p.isClass`.

        if (p.isArray) {
          // Array handling
          if (p.items && p.items.typeName) {
            // Nested Array
            // We need to recursively call plainToInstance for items if they are classes.
            // This requires a registry of compiled transformers?
            // Or we call `TransformerCompiler.plainToInstance(ItemType)(val)`.
            bodyLines.push(`  if (Array.isArray(${access})) {`);
            bodyLines.push(
              `    instance['${propName}'] = ${access}.map(item => validators.plainToInstance(classRefs['${propName}'], item));`,
            );
            bodyLines.push(`  } else { instance['${propName}'] = []; }`);
          } else {
            bodyLines.push(`  instance['${propName}'] = ${access};`);
          }
        } else if (p.type === Number || (typeof p.type === 'string' && p.type.toLowerCase() === 'number')) {
          bodyLines.push(`  instance['${propName}'] = Number(${access});`);
        } else if (p.type === String || (typeof p.type === 'string' && p.type.toLowerCase() === 'string')) {
          bodyLines.push(`  instance['${propName}'] = String(${access});`);
        } else if (p.type === Boolean || (typeof p.type === 'string' && p.type.toLowerCase() === 'boolean')) {
          bodyLines.push(`  instance['${propName}'] = Boolean(${access});`);
        } else if (p.isClass) {
          // Nested Object
          bodyLines.push(`  instance['${propName}'] = validators.plainToInstance(classRefs['${propName}'], ${access});`);
        } else {
          bodyLines.push(`  instance['${propName}'] = ${access};`);
        }
      }
      bodyLines.push('}');
    }

    bodyLines.push('return instance;');

    // Context preparation
    // We need to pass: Target Constructor, Refs to nested classes, and the recursive function itself.

    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('plain', 'Target', 'classRefs', 'validators', bodyLines.join('\n'));

    // Prepare Class Refs Map for this specific compilation
    const classRefs: Record<string, any> = {};
    for (const [propName, prop] of Object.entries(metadata.properties)) {
      const p = prop as any;
      if (p.isClass) {
        classRefs[propName] = p.type;
      }
      if (p.isArray && p.items && typeof p.items.typeName !== 'string') {
        // If items.typeName is a Reference
        classRefs[propName] = p.items.typeName; // For array items, we reuse the key?
        // Logic above used classRefs[propName] for array map too.
      }
    }

    const closure = (plain: any) => {
      return fn(plain, target, classRefs, {
        plainToInstance: (t: any, v: any) => TransformerCompiler.compilePlainToInstance(t)(v),
      });
    };

    this.p2iCache.set(target, closure);
    return closure;
  }

  /**
   * Compiles instanceToPlain function
   */
  static compileInstanceToPlain(target: Function): (instance: any) => any {
    if (this.i2pCache.has(target)) {
      return this.i2pCache.get(target) as any;
    }
    // TODO: Implement Optimization for instanceToPlain (filtering @Hidden, etc)
    // For now, identity or simple spread? No, spread keeps hidden.
    // This is Phase 3 part 2.
    const closure = (instance: any) => ({ ...instance });
    this.i2pCache.set(target, closure);
    return closure;
  }
}
