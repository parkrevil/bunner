import { IsNumber, Min } from '@bunner/core';

export class ChargeDto {
  @(IsNumber() as PropertyDecorator)
  @(Min(1) as PropertyDecorator)
  amount: number;
}
