import { MetadataConsumer } from '../metadata/metadata-consumer';

export class ValidatorCompiler {
  private static cache = new Map<Function, Function>();

  static compile(target: Function): (obj: any) => string[] {
    if (this.cache.has(target)) {
      return this.cache.get(target) as (obj: any) => string[];
    }

    const metadata = MetadataConsumer.getCombinedMetadata(target);
    const lines: string[] = [];

    lines.push('const errors = [];');
    lines.push("if (!obj || typeof obj !== 'object') return ['Invalid object'];");

    for (const [propName, prop] of Object.entries(metadata.properties)) {
      const p = prop as any;
      const access = `obj['${propName}']`;

      // Optional check
      if (p.isOptional) {
        lines.push(`if (${access} !== undefined && ${access} !== null) {`);
      } else {
        // If not optional, checking undefined might be implicitly @IsDefined logic,
        // but strict requirement usually implies validator usage.
        // We wrap in block to allow skipping checks if undefined ONLY IF explicit validators exist?
        // No, we let checking happen.
        lines.push('{');
      }

      // Arrays
      if (p.isArray) {
        lines.push(`  if (!Array.isArray(${access})) {`);
        lines.push(`    errors.push('${propName} must be an array');`);
        lines.push('  } else {');
        lines.push(`    for (let i = 0; i < ${access}.length; i++) {`);
        lines.push(`      const val = ${access}[i];`);
        // Here we would apply individual item validation (e.g. IsString each: true)
        // But for simplicity, we focus on outer validators first.
        // Actually, decorators like @IsString({ each: true }) need handling.
        lines.push('    }');
        lines.push('  }');
      }

      // Apply Decorators
      p.decorators.forEach((dec: any) => {
        const { name, arguments: args, options } = dec;
        const msg = options?.message || `${propName} check failed for ${name}`;

        // Simple generation for built-ins
        if (name === 'IsString') {
          lines.push(`  if (typeof ${access} !== 'string') errors.push('${msg}');`);
        } else if (name === 'IsNumber') {
          lines.push(`  if (typeof ${access} !== 'number' || Number.isNaN(${access})) errors.push('${msg}');`);
        } else if (name === 'IsInt') {
          lines.push(`  if (!Number.isInteger(${access})) errors.push('${msg}');`);
        } else if (name === 'IsBoolean') {
          lines.push(`  if (typeof ${access} !== 'boolean') errors.push('${msg}');`);
        } else if (name === 'Min') {
          lines.push(`  if (${access} < ${args[0]}) errors.push('${msg}');`);
        } else if (name === 'Max') {
          lines.push(`  if (${access} > ${args[0]}) errors.push('${msg}');`);
        } else if (name === 'IsIn') {
          // args[0] is array of values
          const validValues = JSON.stringify(args[0]);
          lines.push(`  if (!${validValues}.includes(${access})) errors.push('${msg}');`);
        } else if (name === 'ValidateNested') {
          // Recursive validation. metatype is in p.metatype
          if (p.metatype) {
             // We need a way to call the compiler for nestedTarget.
             // Since compile is static, we can use ValidatorCompiler.compile(p.metatype)
             // But we need to pass the function into the generated JIT function.
             // Better: we can generate a call if we pass a registry.
             lines.push(`  const nestedErrors = validators.getValidator(${access}, classRefs['${propName}']);`);
             lines.push(`  if (nestedErrors.length > 0) errors.push(...nestedErrors.map(e => \`${propName}.\${e}\`));`);
          }
        }
        // Custom validators would be more complex (calling external function)
      });

      lines.push('}'); // End optional block
    }

    lines.push('return errors;');

    const fnBody = lines.join('\n');
    try {
      // Prepare validators and refs for closure
      const classRefs: Record<string, Function> = {};
      for (const [propName, prop] of Object.entries(metadata.properties)) {
         if ((prop as any).metatype) {
           classRefs[propName] = (prop as any).metatype;
         }
      }

      const validators = {
        getValidator: (val: any, Target: any) => {
            if (!val || !Target) return [];
            if (Array.isArray(val)) {
                let allErrors: string[] = [];
                val.forEach((item, i) => {
                    const errors = ValidatorCompiler.compile(Target)(item);
                    allErrors.push(...errors.map(e => `[${i}].${e}`));
                });
                return allErrors;
            }
            return ValidatorCompiler.compile(Target)(val);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function('obj', 'validators', 'classRefs', fnBody) as (obj: any, validators: any, classRefs: any) => string[];
      
      const wrappedFn = (obj: any) => fn(obj, validators, classRefs);
      this.cache.set(target, wrappedFn);
      return wrappedFn;
    } catch (e) {
      console.error('Failed to compile validator', fnBody);
      throw e;
    }
  }
}
