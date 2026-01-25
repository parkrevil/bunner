import type { Class, PrimitiveArray, PrimitiveRecord, PrimitiveValue } from '@bunner/common';

export type MetadataForwardRef = () => Class;

export type MetadataTypeReference = Class | MetadataForwardRef | string;

export type MetadataTypeValue = MetadataTypeReference | PrimitiveValue;

export type MetadataArgument = PrimitiveValue | PrimitiveArray | PrimitiveRecord;

export type MetadataDecoratorOptions = PrimitiveRecord;
