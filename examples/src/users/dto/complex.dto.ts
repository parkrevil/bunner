import { IsString, IsNumber, IsBoolean, IsIn, Min, Max, IsArray, IsOptional, ValidateNested } from '@bunner/core';

export class AddressDto {
  @IsString()
  street: string;

  @IsNumber()
  zipCode: number;

  @IsBoolean()
  isBusiness: boolean;
}

export class SocialDto {
  @IsIn(['twitter', 'github', 'linkedin'])
  platform: string;

  @IsString()
  url: string;
}

export class CreateUserComplexDto {
  @IsString()
  name: string;

  @Min(18)
  @Max(99)
  age: number;

  @ValidateNested()
  addresses: AddressDto[];

  @ValidateNested()
  social: SocialDto;

  @IsArray()
  tags: string[];

  @IsOptional()
  @IsString()
  bio?: string;
}