import type { ScalarInput, ScalarNode, ScalarValue } from '../scalar/types';

export interface ApiPropertyOptions {
  description?: string;
  required?: boolean;
  type?: ScalarInput;
  isArray?: boolean;
  example?: ScalarNode;
  default?: ScalarNode;
  enum?: readonly ScalarValue[];
  isDeprecated?: boolean;
}

export interface ApiOperationOptions {
  summary?: string;
  description?: string;
  isDeprecated?: boolean;
  operationId?: string;
  tags?: string[];
}

export interface ApiResponseOptions {
  status: number;
  description?: string;
  type?: ScalarInput;
  isArray?: boolean;
}

export interface ApiBodyOptions {
  type: ScalarInput;
  description?: string;
  isArray?: boolean;
}

export interface ApiQueryOptions {
  name: string;
  required?: boolean;
  type?: ScalarInput;
  description?: string;
}

export interface ApiParamOptions {
  name: string;
  type?: ScalarInput;
  description?: string;
}
