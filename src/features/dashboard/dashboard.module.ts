import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardRpcController } from './dashboard.rpc.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  controllers: [DashboardController, DashboardRpcController],
  providers: [DashboardService, DashboardRepository],
  exports: [DashboardService],
})
export class DashboardModule {}
