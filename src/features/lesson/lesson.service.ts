import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_MESSAGES } from 'src/data/constants';
import { LessonRepository } from './lesson.repository';
import { DRIZZLE } from 'src/database/database.module';
import { drizzle } from 'drizzle-orm/postgres-js';
import {
  type CreateLessonBodyDto,
  type UpdateLessonDto,
  type GetLessonsQueryDto,
} from '@packages/entities';
import { checkUuidValid } from '@packages/helpers';

@Injectable()
export class LessonService {
  constructor(
    private readonly lessonRepository: LessonRepository,
    @Inject(DRIZZLE) private readonly db: ReturnType<typeof drizzle>,
  ) {}

  async createLessonService({
    curriculumId,
    chapterId,
    data,
  }: {
    curriculumId: string;
    chapterId?: string | null;
    data: CreateLessonBodyDto;
  }) {
    if (!curriculumId || !checkUuidValid({ data: curriculumId })) {
      throw new BadRequestException(ERROR_MESSAGES.CURRICULUM_ID_MUST_BE_UUID);
    }
    if (chapterId && !checkUuidValid({ data: chapterId })) {
      throw new BadRequestException(ERROR_MESSAGES.CHAPTER_ID_MUST_BE_UUID);
    }
    return await this.lessonRepository.create({ curriculumId, chapterId, data });
  }

  async getAllLessonsService({ query }: { query: GetLessonsQueryDto }) {
    const { curriculumId, chapterId, page, limit } = query;
    if (!curriculumId || !checkUuidValid({ data: curriculumId })) {
      throw new BadRequestException(ERROR_MESSAGES.CURRICULUM_ID_MUST_BE_UUID);
    }
    if (chapterId && !checkUuidValid({ data: chapterId })) {
      throw new BadRequestException(ERROR_MESSAGES.CHAPTER_ID_MUST_BE_UUID);
    }
    return await this.lessonRepository.findAll({ curriculumId, chapterId, page, limit });
  }

  async getLessonByIdService({ id }: { id: string }) {
    if (!id || !checkUuidValid({ data: id })) {
      throw new BadRequestException(ERROR_MESSAGES.LESSON_ID_INVALID);
    }
    return await this.lessonRepository.findById(id);
  }

  async updateLessonService({ id, data }: { id: string; data: UpdateLessonDto }) {
    if (!id || !checkUuidValid({ data: id })) {
      throw new BadRequestException(ERROR_MESSAGES.LESSON_ID_INVALID);
    }
    const existing = await this.lessonRepository.findById(id);
    if (!existing) throw new NotFoundException(ERROR_MESSAGES.LESSON_NOT_FOUND);
    return await this.lessonRepository.update(id, data);
  }

  async deleteLessonService({ id }: { id: string }) {
    if (!id || !checkUuidValid({ data: id })) {
      throw new BadRequestException(ERROR_MESSAGES.LESSON_ID_INVALID);
    }
    const existing = await this.lessonRepository.findById(id);
    if (!existing) throw new NotFoundException(ERROR_MESSAGES.LESSON_NOT_FOUND);
    return await this.lessonRepository.delete(id);
  }
}
