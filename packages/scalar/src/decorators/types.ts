export interface ApiPropertyOptions {
  description?: string;
  required?: boolean;
  type?: unknown;
  isArray?: boolean;
  example?: unknown;
  default?: unknown;
  enum?: readonly unknown[];
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
  type?: unknown;
  isArray?: boolean;
}
