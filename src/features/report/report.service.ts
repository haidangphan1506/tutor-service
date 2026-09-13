import { Injectable } from '@nestjs/common';
import { ReportRepository } from './report.repository';
import type {
  AttendanceTrendPoint,
  ClassReportsApiPayload,
  GetLearningClassReportsQueryDto,
  LearningReportSummary,
} from '@packages/entities/report';

const TREND_MONTHS = 6;

@Injectable()
export class ReportService {
  constructor(private readonly repo: ReportRepository) {}

  async getSummary(): Promise<LearningReportSummary> {
    const allClassIds = await this.repo.getAllClassIds();

    const [activeClasses, attendance, submission, aggregates] = await Promise.all([
      this.repo.countActiveClasses(),
      this.repo.getSessionAttendance(),
      this.repo.getGlobalSubmissionStats(),
      this.repo.getClassAggregates(allClassIds),
    ]);

    const avgAttendanceRate =
      attendance.resolved > 0 ? Math.round((attendance.completed / attendance.resolved) * 100) : 0;
    const submissionRate =
      submission.total > 0 ? Math.round((submission.submitted / submission.total) * 100) : 0;

    const progressValues = allClassIds
      .map((id) => aggregates.get(id))
      .filter((agg): agg is NonNullable<typeof agg> => !!agg && agg.curriculumProgress > 0);
    const avgCurriculumProgress =
      progressValues.length > 0
        ? Math.round(
            progressValues.reduce((sum, agg) => sum + agg.curriculumProgress, 0) /
              progressValues.length,
          )
        : 0;

    return { activeClasses, avgAttendanceRate, avgCurriculumProgress, submissionRate };
  }

  async getAttendanceTrend(): Promise<AttendanceTrendPoint[]> {
    const now = new Date();
    const buckets = Array.from({ length: TREND_MONTHS }, (_, i) => {
      const offset = TREND_MONTHS - 1 - i;
      const from = new Date(now.getFullYear(), now.getMonth() - offset, 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59, 999);
      return { from, to };
    });

    const results = await this.repo.getMonthlySessionAttendance(buckets);

    return buckets.map((bucket, i) => {
      const { completed, resolved } = results[i];
      const rate = resolved > 0 ? Math.round((completed / resolved) * 100) : 0;
      const mm = String(bucket.from.getMonth() + 1).padStart(2, '0');
      return { month: `${mm}/${bucket.from.getFullYear()}`, rate };
    });
  }

  async getClassReports(query: GetLearningClassReportsQueryDto): Promise<ClassReportsApiPayload> {
    const { page, limit, search } = query;
    const offset = (page - 1) * limit;

    const [total, rows] = await Promise.all([
      this.repo.getClassesTotal(search),
      this.repo.getClassesPage({ search, limit, offset }),
    ]);

    const aggregates = await this.repo.getClassAggregates(rows.map((r) => r.id));

    const data = rows.map((row) => {
      const agg = aggregates.get(row.id);
      const tutorName = [row.tutorFirstName, row.tutorLastName].filter(Boolean).join(' ').trim();
      return {
        classId: row.id,
        className: row.name,
        tutorName: tutorName || '—',
        studentCount: agg?.studentCount ?? 0,
        attendanceRate: agg?.attendanceRate ?? 0,
        curriculumProgress: agg?.curriculumProgress ?? 0,
        assignmentsSubmitted: agg?.assignmentsSubmitted ?? 0,
        assignmentsTotal: agg?.assignmentsTotal ?? 0,
        averageScore: agg?.averageScore ?? null,
      };
    });

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
