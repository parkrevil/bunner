import { UseMiddlewares, UseErrorHandlers } from '@bunner/common';
import { Controller, Post, Get, Body } from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';

import { AuditMiddleware } from './audit.middleware';
import { ChargeDto } from './charge.dto';
import { PaymentErrorHandler } from './payment-error.handler';
import { PaymentFailedError } from './payment-failed.error';

@Controller('billing')
@UseMiddlewares(AuditMiddleware)
export class BillingController {
  private logger = new Logger('BillingController');

  @Post('charge')
  @UseErrorHandlers(PaymentErrorHandler)
  charge(@Body() body: ChargeDto) {
    const amount = body.amount || 0;

    this.logger.info(`Attempting to charge $${amount}...`);

    if (amount <= 0) {
      throw new Error('Invalid amount'); // Should be caught by Global Handler
    }

    if (amount > 1000) {
      throw new PaymentFailedError(amount, 'Insufficient funds for checking account');
    }

    return {
      success: true,
      transactionId: 'txn_' + Math.random().toString(36).substr(2, 9),
      amount,
      status: 'COMPLETED',
    };
  }

  @Get('history')
  getHistory() {
    return [
      { date: '2025-12-01', amount: 50, status: 'COMPLETED' },
      { date: '2025-12-15', amount: 120, status: 'COMPLETED' },
    ];
  }
}
