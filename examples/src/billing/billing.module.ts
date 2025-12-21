import { Module } from '@bunner/core';

import { BillingController } from './billing.controller';

@Module({
  controllers: [BillingController],
})
export class BillingModule {}
