import { Module } from '../../../../src';
import { CacheModule } from '../cache';
import { EmailService } from './email.service';

/**
 * Email module
 */
@Module({
  imports: [() => CacheModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule { }
