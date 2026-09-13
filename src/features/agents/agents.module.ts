import { Module } from '@nestjs/common';
import { AgentController } from './agents.controller';
import { AgentsRpcController } from './agents.rpc.controller';
import { AgentsService } from './agents.service';

@Module({
  controllers: [AgentController, AgentsRpcController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
