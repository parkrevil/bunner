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
    lines.push('if (!obj || typeof obj !== \'object\') return [\'Invalid object\'];');

    for (const [propName, prop] of Object.entries(metadata.properties)) {
      const p = prop;
      const access = `obj['${propName}']`;

      if (p.isOptional) {
        lines.push(`if (${access} !== undefined && ${access} !== null) {`);
      } else {
        lines.push('{');
      }

      if (p.isArray) {
        lines.push(`  if (!Array.isArray(${access})) {`);
        lines.push(`    errors.push('${propName} must be an array');`);
        lines.push('  } else {');
        lines.push(`    for (let i = 0; i < ${access}.length; i++) {`);
        lines.push(`      const val = ${access}[i];`);
        lines.push('    }');
        lines.push('  }');
      }

      p.decorators.forEach((dec: any) => {
        const { name, arguments: args, options } = dec;
        const msg = options?.message || `${propName} check failed for ${name}`;

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
          const validValues = JSON.stringify(args[0]);
          lines.push(`  if (!${validValues}.includes(${access})) errors.push('${msg}');`);
        } else if (name === 'ValidateNested') {
          if (p.metatype) {
            lines.push(`  const nestedErrors = validators.getValidator(${access}, classRefs['${propName}']);`);
            lines.push(`  if (nestedErrors.length > 0) errors.push(...nestedErrors.map(e => \`${propName}.\${e}\`));`);
          }
        }
      });

      lines.push('}');
    }

    lines.push('return errors;');

    const fnBody = lines.join('\n');
    try {
      const classRefs: Record<string, Function> = {};
      for (const [propName, prop] of Object.entries(metadata.properties)) {
        if (prop.metatype) {
          classRefs[propName] = prop.metatype;
        }
      }

      const validators = {
        getValidator: (val: any, Target: any) => {
          if (!val || !Target) {
            return [];
          }
          if (Array.isArray(val)) {
            const allErrors: string[] = [];
            val.forEach((item, i) => {
              const errors = ValidatorCompiler.compile(Target)(item);
              allErrors.push(...errors.map(e => `[${i}].${e}`));
            });
            return allErrors;
          }
          return ValidatorCompiler.compile(Target)(val);
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function('obj', 'validators', 'classRefs', fnBody) as (
        obj: any,
        validators: any,
        classRefs: any,
      ) => string[];

      const wrappedFn = (obj: any) => fn(obj, validators, classRefs);
      this.cache.set(target, wrappedFn);
      return wrappedFn;
    } catch (e) {
      console.error('Failed to compile validator', fnBody);
      throw e;
    }
  }
}
