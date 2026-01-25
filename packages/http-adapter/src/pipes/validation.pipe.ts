import { ValidatorCompiler, TransformerCompiler } from '@bunner/core';
import { StatusCodes } from 'http-status-codes';

import type { ArgumentMetadata, PipeTransform } from '../interfaces';
import type { RouteParamValue } from '../types';

export class ValidationPipe implements PipeTransform {
  transform(value: RouteParamValue, metadata: ArgumentMetadata): RouteParamValue {
    if (!metadata.metatype || !this.toValidate(metadata.metatype)) {
      return value;
    }

    const p2iFn = TransformerCompiler.compilePlainToInstance(metadata.metatype);
    const object = p2iFn(value);
    const validateFn = ValidatorCompiler.compile(metadata.metatype);
    const errors = validateFn(object);

    if (errors.length > 0) {
      const error = new Error('Validation failed');

      Object.assign(error, {
        status: StatusCodes.BAD_REQUEST,
        details: errors,
      });

      throw error;
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    if (typeof metatype !== 'function') {
      return false;
    }

    const types: Function[] = [String, Boolean, Number, Array, Object];

    return !types.includes(metatype);
  }
}
