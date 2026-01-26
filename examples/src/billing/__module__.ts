import type { BunnerModule } from '@bunner/core';

import { AuditMiddleware } from './audit.middleware';
import { PaymentErrorFilter } from './payment-error.filter';

export const module: BunnerModule = {
  name: 'BillingModule',
  providers: [
    AuditMiddleware,
    PaymentErrorFilter, // Registered as providers so they can be injected or found
  ],
  // If these are used as local middlewares/filters for controllers in this module,
  // they are usually applied via @UseMiddleware or default adapter config here.
  // The original BillingModule had them in providers, suggesting they were just registered.
};
