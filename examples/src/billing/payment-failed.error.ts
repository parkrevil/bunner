export class PaymentFailedError extends Error {
  constructor(
    public amount: number,
    public reason: string,
  ) {
    super(`Payment of $${amount} failed: ${reason}`);

    this.name = 'PaymentFailedError';
  }
}
