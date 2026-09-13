import { Module } from '@nestjs/common';
import { ClassController } from './class.controller';
import { ClassRpcController } from './class.rpc.controller';
import { ClassRepository } from './class.repository';
import { ClassService } from './class.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  controllers: [ClassController, ClassRpcController],
  providers: [ClassService, ClassRepository],
  exports: [ClassService],
})
export class ClassModule {}
