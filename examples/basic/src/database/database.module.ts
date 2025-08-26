import { Module } from '../../../../src';
import { AuthModule } from '../auth';
import { DatabaseService } from './database.service';

/**
 * Database module
 */
@Module({
  imports: [() => AuthModule],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule { }
