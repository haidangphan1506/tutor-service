import { Module } from '@nestjs/common';
import { LessonController } from './lesson.controller';
import { LessonRpcController } from './lesson.rpc.controller';
import { LessonService } from './lesson.service';
import { LessonRepository } from './lesson.repository';

@Module({
  imports: [],
  controllers: [LessonController, LessonRpcController],
  providers: [LessonService, LessonRepository],
  exports: [LessonService],
})
export class LessonModule {}
