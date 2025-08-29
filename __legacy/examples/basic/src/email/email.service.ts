import { Inject, Injectable, LazyServiceIdentifier } from '../../../../src';
import { CacheService } from '../cache';

@Injectable()
export class EmailService {
  constructor(@Inject(new LazyServiceIdentifier(() => CacheService)) private readonly cacheService: CacheService) { }

  /**
   * Send email
   * @param to - Recipient email
   * @param subject - Email subject
   * @param body - Email body
   * @returns Email result
   */
  sendEmail(to: string, subject: string, body: string) {
    const cacheData = this.cacheService.get('email_template');
    return {
      to,
      subject,
      body,
      sent: true,
      cacheData,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get email templates
   * @returns Email templates
   */
  getTemplates() {
    return {
      welcome: 'Welcome template',
      reset: 'Reset password template',
      notification: 'Notification template'
    };
  }
}
