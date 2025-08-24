import { Inject, Injectable, forwardRef } from '../../../../src';
import { AuthService } from '../auth';

@Injectable()
export class DatabaseService {
  constructor(@Inject(forwardRef(() => AuthService)) private readonly authService: AuthService) { }

  /**
   * Get database connection
   * @returns Database connection info
   */
  getConnection() {
    const authStatus = this.authService.getAuthStatus();
    return {
      connected: true,
      authStatus,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute database query
   * @param query - The query to execute
   * @returns Query result
   */
  executeQuery(query: string) {
    return {
      query,
      result: 'success',
      authRequired: true
    };
  }
}
