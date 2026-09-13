export enum AgentsRole {
  SYSTEM = 'system', // chỉ dùng ở top-level `system` param, hoặc mid-conversation (Opus 5+)
  USER = 'user', // input người dùng + tool_result
  ASSISTANT = 'assistant', // output của Claude (text, tool_use, thinking)
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  | { type: 'thinking'; thinking: string; signature: string };

export interface AgentsMessage {
  role: AgentsRole.USER | AgentsRole.ASSISTANT;
  content: string | ContentBlock[];
}

export interface AgentsConversationState {
  systemPrompt: string;
  messages: AgentsMessage[];
}
