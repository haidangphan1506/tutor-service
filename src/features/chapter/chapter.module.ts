import { Module } from '@nestjs/common';
import { ChapterController } from './chapter.controller';
import { ChapterRpcController } from './chapter.rpc.controller';
import { ChapterService } from './chapter.service';
import { ChapterRepository } from './chapter.repository';

@Module({
  controllers: [ChapterController, ChapterRpcController],
  providers: [ChapterService, ChapterRepository],
  exports: [ChapterService],
})
export class ChapterModule {}
