import { Inject, Injectable } from '../../../../src';
import { UsersService } from '../users';

@Injectable()
export class AuthService {
  constructor(@Inject(Symbol.for('Factory:UsersService')) private readonly getUsersService: () => UsersService) { }

  /**
   * Authenticate user by ID
   * @param userId - The user ID to authenticate
   * @returns Authentication result
   */
  authenticate(userId: number) {
    const usersService = this.getUsersService();
    const user = usersService.getById(userId);
    return {
      authenticated: !!user,
      user: user,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get authentication status
   * @returns Authentication status
   */
  getAuthStatus() {
    return {
      status: 'active',
      service: 'auth-service'
    };
  }
}
