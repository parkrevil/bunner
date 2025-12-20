import { ValidatorCompiler, TransformerCompiler } from '@bunner/core';
import { StatusCodes } from 'http-status-codes';

import type { ArgumentMetadata, PipeTransform } from '../interfaces';

export class ValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (!metadata.metatype || !this.toValidate(metadata.metatype)) {
      return value;
    }

    const p2iFn = TransformerCompiler.compilePlainToInstance(metadata.metatype);
    const object = p2iFn(value);

    const validateFn = ValidatorCompiler.compile(metadata.metatype);
    const errors = validateFn(object);

    if (errors.length > 0) {

      const error: any = new Error('Validation failed');
      error.status = StatusCodes.BAD_REQUEST;
      error.details = errors;
      throw error;
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}