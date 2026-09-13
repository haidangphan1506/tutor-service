import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { ScheduleRpcController } from './schedule.rpc.controller';
import { ScheduleRepository } from './schedule.repository';
import { ScheduleService } from './schedule.service';
import { ClassModule } from '../class/class.module';

@Module({
  imports: [ClassModule],
  controllers: [ScheduleController, ScheduleRpcController],
  providers: [ScheduleService, ScheduleRepository],
  exports: [ScheduleService],
})
export class ScheduleModule {}
