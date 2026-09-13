import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceRpcController } from './attendance.rpc.controller';
import { AttendanceRepository } from './attendance.repository';
import { AttendanceService } from './attendance.service';
import { SessionModule } from '../session/session.module';
import { ClassModule } from '../class/class.module';

@Module({
  imports: [SessionModule, ClassModule],
  controllers: [AttendanceController, AttendanceRpcController],
  providers: [AttendanceService, AttendanceRepository],
  exports: [AttendanceService],
})
export class AttendanceModule {}
