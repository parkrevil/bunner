import { IsBoolean, IsNumber, IsString } from '@bunner/core';

export class AddressDto {
  @IsString()
  street: string;

  @IsNumber()
  zipCode: number;

  @IsBoolean()
  isBusiness: boolean;
}
