import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

export type AgentMessage = SDKUserMessage['message'];

export type AgentMessageRole = AgentMessage['role'];

export interface ClaudeTool {
  name: string;

  description: string;

  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };

  execute(input: Record<string, unknown>): Promise<unknown>;
}
