/**
 * Application Configuration
 *
 * Loads configuration from environment variables with sensible defaults.
 */

import { config as loadDotenv } from 'dotenv';

// Load .env file
loadDotenv();

export interface AppConfig {
  /** Port to run the server on */
  port: number;
  /** Host to bind to */
  host: string;
  /** Directory for data storage (database, bot workspaces) */
  dataDir: string;
  /** Directory for secrets storage */
  secretsDir: string;
  /** Docker volume name for data (for runtime path discovery) */
  dataVolumeName: string | null;
  /** Docker volume name for secrets (for runtime path discovery) */
  secretsVolumeName: string | null;
  /** Docker image for OpenClaw bots */
  openclawImage: string;
  /** Git tag for OpenClaw (for building image if needed) */
  openclawGitTag: string;
  /** Starting port for bot containers */
  botPortStart: number;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvIntOrDefault(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get application configuration.
 * Reads from environment variables with defaults.
 */
export function getConfig(): AppConfig {
  return {
    port: getEnvIntOrDefault('PORT', 7100),
    host: getEnvOrDefault('HOST', '0.0.0.0'),
    dataDir: getEnvOrDefault('DATA_DIR', './data'),
    secretsDir: getEnvOrDefault('SECRETS_DIR', './secrets'),
    dataVolumeName: process.env.DATA_VOLUME_NAME ?? null,
    secretsVolumeName: process.env.SECRETS_VOLUME_NAME ?? null,
    openclawImage: getEnvOrDefault('OPENCLAW_IMAGE', 'openclaw:latest'),
    openclawGitTag: getEnvOrDefault('OPENCLAW_GIT_TAG', 'main'),
    botPortStart: getEnvIntOrDefault('BOT_PORT_START', 19000),
  };
}

export default getConfig;
