import { Module } from '@bunner/common';

import { AuditMiddleware } from './audit.middleware';
import { BillingController } from './billing.controller';
import { PaymentErrorFilter } from './payment-error.filter';

@Module({
  controllers: [BillingController],
  providers: [AuditMiddleware, PaymentErrorFilter],
})
export class BillingModule {}
