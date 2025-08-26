import { Module, type OnModuleInit } from '../../../../src';
import { AnalyticsModule } from '../analytics';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AnalyticsModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService]
})
export class UsersModule implements OnModuleInit {
  onModuleInit() {
    console.log('UsersModule initialized');
  }
}
