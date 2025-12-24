import { Module } from '@bunner/common';

import { AuditMiddleware } from './audit.middleware';
import { BillingController } from './billing.controller';
import { PaymentErrorHandler } from './payment-error.handler';

@Module({
  controllers: [BillingController],
  providers: [AuditMiddleware, PaymentErrorHandler],
})
export class BillingModule {}
