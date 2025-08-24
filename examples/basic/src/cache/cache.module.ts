import { Module, forwardRef } from '../../../../src';
import { DatabaseModule } from '../database';
import { CacheService } from './cache.service';

/**
 * Cache module
 */
@Module({
  imports: [forwardRef(() => DatabaseModule)],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule { }
