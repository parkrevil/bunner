import { Module, forwardRef } from '../../../../src';
import { EmailModule } from '../email';
import { NotificationService } from './notification.service';

/**
 * Notification module
 */
@Module({
  imports: [forwardRef(() => EmailModule)],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule { }
