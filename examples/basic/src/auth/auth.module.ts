import { Module, forwardRef } from '../../../../src';
import { UsersModule } from '../users';
import { AuthService } from './auth.service';

/**
 * Auth module
 */
@Module({
  imports: [forwardRef(() => UsersModule)],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule { }
