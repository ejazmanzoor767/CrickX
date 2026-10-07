import { Global, Module } from '@nestjs/common';
import { CloudSqlService } from './cloud-sql.service';

@Global()
@Module({
  providers: [CloudSqlService],
  exports: [CloudSqlService],
})
export class CloudSqlModule {}
