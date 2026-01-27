import { IsNumber, Min } from '@bunner/core';

export class ChargeDto {
  @IsNumber()
  @Min(1)
  amount: number;
}
