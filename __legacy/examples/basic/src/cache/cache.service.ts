import { Inject, Injectable, LazyServiceIdentifier } from '../../../../src';
import { DatabaseService } from '../database';

@Injectable()
export class CacheService {
  constructor(@Inject(new LazyServiceIdentifier(() => DatabaseService)) private readonly databaseService: DatabaseService) { }

  /**
   * Get cached data
   * @param key - Cache key
   * @returns Cached data
   */
  get(key: string) {
    const connection = this.databaseService.getConnection();
    return {
      key,
      value: 'cached_value',
      connection,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Set cache data
   * @param key - Cache key
   * @param value - Cache value
   * @returns Cache result
   */
  set(key: string, value: any) {
    return {
      key,
      value,
      cached: true,
      timestamp: new Date().toISOString()
    };
  }
}
