import { Module } from '../../../../src';
import { DatabaseModule } from '../database';
import { CacheService } from './cache.service';

/**
 * Cache module
 */
@Module({
  imports: [() => DatabaseModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule { }
