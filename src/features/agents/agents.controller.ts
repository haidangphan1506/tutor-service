import { Controller, Post } from '@nestjs/common';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { AgentsService } from './agents.service';
import { Public } from '@packages/decorators';

@Controller()
export class AgentController {
  constructor(private readonly agentsService: AgentsService) {}

  @Public()
  @Post('run')
  run(): Promise<SDKMessage[]> {
    return this.agentsService.run('1+1=?');
  }
}
