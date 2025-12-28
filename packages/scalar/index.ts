export {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
} from './src/decorators';

export type { ApiOperationOptions, ApiPropertyOptions, ApiResponseOptions } from './src/decorators';

export { provideScalar } from './src/scalar/provide-scalar';
export { ScalarConfigurer } from './src/scalar/scalar-configurer';
export { ScalarSetupOptionsToken } from './src/scalar/tokens';
export type { ScalarSetupOptions } from './src/scalar/interfaces';
