import type { BunnerValue, Class, PrimitiveArray, PrimitiveRecord, PrimitiveValue } from '@bunner/common';

export type ValidatorTarget = Class;

export type ValidatorValueItem = PrimitiveValue | PrimitiveArray | PrimitiveRecord;

export type ValidatorValueArray = Array<ValidatorValueItem>;

export type ValidatorValueRecord = Record<string, ValidatorValueItem | ValidatorValueArray>;

export type ValidatorValue = ValidatorValueItem | ValidatorValueArray | ValidatorValueRecord;

export type ValidationErrors = string[];

export type ValidatorOptionValue = PrimitiveValue | PrimitiveArray | PrimitiveRecord;

export type ValidatorDecoratorArgument = ValidatorOptionValue;

export type ValidatorDecoratorArgs = ReadonlyArray<ValidatorDecoratorArgument>;

export type ValidatorDecoratorTarget = BunnerValue;

export type ValidatorPropertyDecorator = PropertyDecorator;
