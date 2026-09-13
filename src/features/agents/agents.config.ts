export const CLAUDE_MODELS = {
  opus: 'claude-opus-5',
  sonnet: 'claude-sonnet-5',
  haiku: 'claude-haiku-4-5-20251001',
  fable: 'claude-fable-5-1',
} as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS];

export const CLAUDE_CONFIG = {
  system: {
    model: CLAUDE_MODELS.sonnet,
    maxTokens: 4096,
  },

  chat: {
    model: CLAUDE_MODELS.sonnet,
    maxTokens: 8192,
  },

  toolSelection: {
    model: CLAUDE_MODELS.sonnet,
    maxTokens: 4096,
  },

  toolExecution: {
    model: CLAUDE_MODELS.haiku,
    maxTokens: 4096,
  },

  reasoning: {
    model: CLAUDE_MODELS.sonnet,
    maxTokens: 16384,
  },

  coding: {
    model: CLAUDE_MODELS.opus,
    maxTokens: 16384,
  },

  simple: {
    model: CLAUDE_MODELS.haiku,
    maxTokens: 4096,
  },
} as const;
