import { IsString, IsNumber, IsBoolean, IsIn, Min, Max, IsArray, IsOptional, ValidateNested } from '@bunner/core';

export class AddressDto {
  @(IsString() as PropertyDecorator)
  street: string;

  @(IsNumber() as PropertyDecorator)
  zipCode: number;

  @(IsBoolean() as PropertyDecorator)
  isBusiness: boolean;
}

export class SocialDto {
  @(IsIn(['twitter', 'github', 'linkedin']) as PropertyDecorator)
  platform: string;

  @(IsString() as PropertyDecorator)
  url: string;
}

export class CreateUserComplexDto {
  @(IsString() as PropertyDecorator)
  name: string;

  @(Min(18) as PropertyDecorator)
  @(Max(99) as PropertyDecorator)
  age: number;

  @(ValidateNested() as PropertyDecorator)
  addresses: AddressDto[];

  @(ValidateNested() as PropertyDecorator)
  social: SocialDto;

  @(IsArray() as PropertyDecorator)
  tags: string[];

  @(IsOptional() as PropertyDecorator)
  @(IsString() as PropertyDecorator)
  bio?: string;
}
