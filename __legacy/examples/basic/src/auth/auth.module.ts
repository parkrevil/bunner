import { Module } from '../../../../src';
import { UsersModule } from '../users';
import { AuthService } from './auth.service';

/**
 * Auth module
 */
@Module({
  imports: [() => UsersModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule { }
