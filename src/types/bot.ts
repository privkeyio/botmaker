export type BotStatus = 'created' | 'running' | 'stopped' | 'error';

export interface Bot {
  id: string;           // UUID
  name: string;         // Unique bot name
  ai_provider: string;  // openai, anthropic, etc.
  model: string;        // gpt-4, claude-3, etc.
  channel_type: string; // slack, discord, telegram, etc.
  container_id: string | null;
  port: number | null;  // Allocated port for container
  gateway_token: string | null; // OpenClaw gateway authentication token
  status: BotStatus;
  created_at: string;   // ISO datetime
  updated_at: string;   // ISO datetime
}
