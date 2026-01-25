import type { Class, PrimitiveArray, PrimitiveRecord, PrimitiveValue } from '@bunner/common';

export type TransformerValueItem = PrimitiveValue | PrimitiveRecord | InstanceType<Class>;

export type TransformerValueArray = Array<TransformerValueItem>;

export type TransformerValueRecord = Record<string, TransformerValueItem | TransformerValueArray>;

export type TransformerValue = TransformerValueItem | TransformerValueArray | TransformerValueRecord;

export type TransformerPlainValue = PrimitiveValue | PrimitiveArray | PrimitiveRecord;

export type TransformerPlainRecord = PrimitiveRecord;

export type TransformerDecoratorTarget = Record<string, TransformerValue>;

export type ClassRefs = Record<string, Class | null | undefined>;

export type PlainToInstanceFn = (plain: TransformerPlainValue) => TransformerValue;

export type InstanceToPlainFn = (instance: TransformerValue) => TransformerValueRecord;

export type PlainToInstanceValidator = (target: Class | null | undefined, value: TransformerPlainValue) => TransformerValue;

export type InstanceToPlainConverter = (value: TransformerValue, target?: Class | null) => TransformerPlainValue;
