import { ValidatorCompiler, TransformerCompiler } from '@bunner/core';
import { StatusCodes } from 'http-status-codes';

import type { ArgumentMetadata, PipeTransform } from '../interfaces';

export class ValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (!metadata.metatype || !this.toValidate(metadata.metatype)) {
      return value;
    }

    // 1. Transformation (plainToInstance)
    // JIT: TransformerCompiler.compilePlainToInstance(metatype) returns (plain) => instance
    const p2iFn = TransformerCompiler.compilePlainToInstance(metadata.metatype);
    const object = p2iFn(value);

    // 2. Validation
    // JIT: ValidatorCompiler.compile(metatype) returns (obj) => errors[]
    const validateFn = ValidatorCompiler.compile(metadata.metatype);
    const errors = validateFn(object);

    if (errors.length > 0) {
      // Throw Http Error?
      // Since we don't have HttpExceptions in core/http-server yet generally exposed,
      // we throw a standard error with status property or similar.
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
