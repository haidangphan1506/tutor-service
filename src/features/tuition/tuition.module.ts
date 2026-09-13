import { Module } from '@nestjs/common';
import { TuitionController } from './tuition.controller';
import { TuitionRpcController } from './tuition.rpc.controller';
import { TuitionRepository } from './tuition.repository';
import { TuitionService } from './tuition.service';

@Module({
  imports: [],
  controllers: [TuitionController, TuitionRpcController],
  providers: [TuitionService, TuitionRepository],
  exports: [TuitionService],
})
export class TuitionModule {}
