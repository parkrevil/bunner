import { Inject, Injectable, forwardRef } from '../../../../src';
import { EmailService } from '../email';

@Injectable()
export class NotificationService {
  constructor(@Inject(forwardRef(() => EmailService)) private readonly emailService: EmailService) { }

  /**
   * Send notification
   * @param userId - User ID
   * @param message - Notification message
   * @returns Notification result
   */
  sendNotification(userId: number, message: string) {
    const emailResult = this.emailService.sendEmail('user@example.com', 'Notification', message);
    return {
      userId,
      message,
      sent: true,
      emailResult,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get notification settings
   * @returns Notification settings
   */
  getSettings() {
    return {
      email: true,
      push: false,
      sms: false
    };
  }
}
