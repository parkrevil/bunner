export class PaymentFailedError extends Error {
  public readonly amount: number;
  public readonly reason: string;

  constructor(message?: string);
  constructor(amount: number, reason: string);
  constructor(amountOrMessage?: number | string, reason?: string) {
    const isAmount = typeof amountOrMessage === 'number';
    const resolvedAmount = isAmount ? amountOrMessage : 0;
    const resolvedReason = isAmount ? reason ?? 'Unknown reason' : 'Unknown reason';
    const resolvedMessage = isAmount
      ? `Payment of $${resolvedAmount} failed: ${resolvedReason}`
      : (amountOrMessage ?? 'Payment failed');

    super(resolvedMessage);

    this.name = 'PaymentFailedError';
    this.amount = resolvedAmount;
    this.reason = resolvedReason;
  }
}
