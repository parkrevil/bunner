export interface ApiPropertyOptions {
  description?: string;
  required?: boolean;
  type?: any;
  isArray?: boolean;
  example?: any;
  default?: any;
  enum?: any;
  deprecated?: boolean;
}

export interface ApiOperationOptions {
  summary?: string;
  description?: string;
  deprecated?: boolean;
  operationId?: string;
  tags?: string[];
}

export interface ApiResponseOptions {
  status: number;
  description?: string;
  type?: any;
  isArray?: boolean;
}

export function ApiProperty(_options?: ApiPropertyOptions): PropertyDecorator {
  return () => {};
}

export function ApiPropertyOptional(_options?: ApiPropertyOptions): PropertyDecorator {
  return () => {};
}

export function ApiTags(..._tags: string[]): ClassDecorator {
  return () => {};
}

export function ApiBearerAuth(): ClassDecorator {
  return () => {};
}

export function ApiOperation(_options: ApiOperationOptions): MethodDecorator {
  return () => {};
}

export function ApiResponse(_options: ApiResponseOptions): MethodDecorator {
  return () => {};
}

export function ApiOkResponse(_options?: Omit<ApiResponseOptions, 'status'>): MethodDecorator {
  return () => {};
}

export function ApiCreatedResponse(_options?: Omit<ApiResponseOptions, 'status'>): MethodDecorator {
  return () => {};
}

export function ApiNotFoundResponse(_options?: Omit<ApiResponseOptions, 'status'>): MethodDecorator {
  return () => {};
}

export function ApiBody(_options: { type: any; description?: string; isArray?: boolean }): MethodDecorator {
  return () => {};
}

export function ApiQuery(_options: { name: string; required?: boolean; type?: any; description?: string }): MethodDecorator {
  return () => {};
}

export function ApiParam(_options: { name: string; type?: any; description?: string }): MethodDecorator {
  return () => {};
}
