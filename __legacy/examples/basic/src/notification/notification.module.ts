import { Module } from '../../../../src';
import { EmailModule } from '../email';
import { NotificationService } from './notification.service';

/**
 * Notification module
 */
@Module({
  imports: [() => EmailModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule { }
