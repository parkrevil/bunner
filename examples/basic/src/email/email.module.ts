import { Module, forwardRef } from '../../../../src';
import { CacheModule } from '../cache';
import { EmailService } from './email.service';

/**
 * Email module
 */
@Module({
  imports: [forwardRef(() => CacheModule)],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule { }
