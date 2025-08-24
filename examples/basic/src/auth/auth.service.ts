import { Inject, Injectable, forwardRef } from '../../../../src';
import { UsersService } from '../users';

@Injectable()
export class AuthService {
  constructor(@Inject(forwardRef(() => UsersService)) private readonly usersService: UsersService) { }

  /**
   * Authenticate user by ID
   * @param userId - The user ID to authenticate
   * @returns Authentication result
   */
  authenticate(userId: number) {
    const user = this.usersService.getById(userId);
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
