export type QueryValue = string | QueryArray | QueryValueRecord;

export type QueryArray = QueryValue[];

export type QueryValueRecord = Record<string, QueryValue>;

export type QueryContainer = QueryValueRecord | QueryArray;

export type QueryArrayRecord = QueryArray & Record<string, QueryValue>;
