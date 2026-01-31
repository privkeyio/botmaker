export type BotStatus = 'created' | 'running' | 'stopped' | 'error';

export interface ContainerStatus {
  id: string;
  state: string;
  running: boolean;
  exitCode: number;
  startedAt: string;
  finishedAt: string;
}

export interface Bot {
  id: string;
  name: string;
  ai_provider: string;
  model: string;
  channel_type: string;
  container_id: string | null;
  port: number | null;
  status: BotStatus;
  created_at: string;
  updated_at: string;
  container_status?: ContainerStatus | null;
}

export interface CreateBotInput {
  name: string;
  ai_provider: string;
  model: string;
  channel_type: 'telegram' | 'discord';
  channel_token: string;
  api_key: string;
  persona: {
    name: string;
    identity: string;
    description: string;
  };
}

export interface ContainerStats {
  botId: string;
  name: string;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  timestamp: string;
}

export interface OrphanReport {
  orphanedContainers: string[];
  orphanedWorkspaces: string[];
  orphanedSecrets: string[];
  total: number;
}

export interface CleanupReport {
  success: boolean;
  containersRemoved: number;
  workspacesRemoved: number;
  secretsRemoved: number;
}
