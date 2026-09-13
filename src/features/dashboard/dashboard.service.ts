import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_MESSAGES } from 'src/data/constants';
import { checkUuidValid } from '@packages/helpers';
import {
  DashboardRepository,
  type MonthlyRow,
  type TodayScheduleRow,
} from './dashboard.repository';
import { UserService } from '../user/user.service';

export interface DashboardOverview {
  role: string;
  stats: {
    classesCount: number;
    studentsCount: number;
    sessionsThisWeek: number;
    sessionsCompletedThisWeek: number;
    sessionsTodayCompleted: number;
    sessionsTodayPending: number;
    revenueThisMonth: number;
    overdueTuitionCount: number;
    unpaidTuitionAmount: number;
  };
  todaySchedule: TodayScheduleRow[];
  upcomingSchedule: TodayScheduleRow[];
  monthly: MonthlyRow[];
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly repo: DashboardRepository,
    private readonly userService: UserService,
  ) {}

  private startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private endOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  // Monday as the first day of the week
  private startOfWeek(d: Date) {
    const x = this.startOfDay(d);
    const day = (x.getDay() + 6) % 7; // 0 = Monday
    x.setDate(x.getDate() - day);
    return x;
  }

  async getOverview(userId: string): Promise<DashboardOverview> {
    if (!userId || !checkUuidValid({ data: userId }))
      throw new BadRequestException(ERROR_MESSAGES.USER_ID_MUST_BE_UUID);

    const users = await this.userService.getUserByField({ field: 'id', value: userId });
    const user = Array.isArray(users) ? users[0] : users;
    if (!user) throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);

    const role = user.role ?? 'STUDENT';
    const isStudent = role === 'STUDENT';

    const classIds = isStudent
      ? await this.repo.getStudentClassIds(userId)
      : await this.repo.getTutorClassIds(userId);

    const now = new Date();
    const weekStart = this.startOfWeek(now);
    const weekEnd = this.endOfDay(new Date(weekStart.getTime() + 6 * 86_400_000));
    const dayStart = this.startOfDay(now);
    const dayEnd = this.endOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const year = now.getFullYear();

    const [
      studentsCount,
      sessionStats,
      todaySessions,
      todaySchedule,
      upcomingSchedule,
      revenueThisMonth,
      monthlyRevenue,
      monthlySessions,
      monthlyStudents,
      monthlyClasses,
    ] = await Promise.all([
      isStudent ? Promise.resolve(0) : this.repo.countStudents(classIds),
      this.repo.getSessionStats(classIds, weekStart, weekEnd),
      this.repo.getSessionsToday(classIds, dayStart, dayEnd),
      this.repo.getSchedule(classIds, dayStart, dayEnd),
      this.repo.getUpcomingSchedule(classIds, now, 5),
      isStudent ? Promise.resolve(0) : this.repo.getRevenue(classIds, monthStart, monthEnd),
      this.repo.getMonthlyRevenue(classIds, year),
      this.repo.getMonthlySessions(classIds, year),
      this.repo.getNewStudentsByMonth(classIds, year),
      this.repo.getNewClassesByMonth(classIds, year),
    ]);

    const overdue = await this.repo.getTuitionSum(
      classIds,
      'OVERDUE',
      isStudent ? userId : undefined,
    );
    const unpaid = await this.repo.getTuitionSum(
      classIds,
      'UNPAID',
      isStudent ? userId : undefined,
    );
    const unpaidTuitionAmount = isStudent ? unpaid.total + overdue.total : unpaid.total;

    let cumulativeRevenue = 0;
    const monthly: MonthlyRow[] = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const revenue = monthlyRevenue.get(m) ?? 0;
      cumulativeRevenue += revenue;
      return {
        month: m,
        revenue,
        sessions: monthlySessions.get(m) ?? 0,
        newStudents: monthlyStudents.get(m) ?? 0,
        newClasses: monthlyClasses.get(m) ?? 0,
        cumulativeRevenue,
      };
    });

    return {
      role,
      stats: {
        classesCount: classIds.length,
        studentsCount,
        sessionsThisWeek: sessionStats.total,
        sessionsCompletedThisWeek: sessionStats.completed,
        sessionsTodayCompleted: todaySessions.completed,
        sessionsTodayPending: todaySessions.pending,
        revenueThisMonth,
        overdueTuitionCount: overdue.count,
        unpaidTuitionAmount,
      },
      todaySchedule,
      upcomingSchedule,
      monthly,
    };
  }
}
