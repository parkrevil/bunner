import { Module, forwardRef } from '../../../../src';
import { NotificationModule } from '../notification';
import { AnalyticsService } from './analytics.service';

/**
 * Analytics module
 */
@Module({
  imports: [forwardRef(() => NotificationModule)],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule { }
