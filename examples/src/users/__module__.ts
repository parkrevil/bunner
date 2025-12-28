import type { BunnerModule } from '@bunner/common';

import { UserRepository } from './users.repository';
import { UsersService } from './users.service';

export const module: BunnerModule = {
  name: 'UsersModule',
  providers: [UsersService, UserRepository],
};
