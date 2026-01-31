/**
 * Fastify Server
 *
 * API routes for bot management.
 */

import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

import { getConfig } from './config.js';
import { initDb } from './db/index.js';
import {
  createBot,
  getBot,
  getBotByHostname,
  listBots,
  updateBot,
  deleteBot,
  getNextBotPort,
} from './bots/store.js';
import { createBotWorkspace, deleteBotWorkspace } from './bots/templates.js';
import { writeSecret, deleteBotSecrets } from './secrets/manager.js';
import { DockerService } from './services/DockerService.js';
import { ReconciliationService } from './services/ReconciliationService.js';
import { ContainerError } from './services/docker-errors.js';

const docker = new DockerService();

type SessionScope = 'user' | 'channel' | 'global';

interface CreateBotBody {
  name: string;
  hostname: string;
  emoji: string;
  avatarUrl?: string;
  providers?: { providerId: string; apiKey: string; model: string }[];
  primaryProvider?: string;
  channels?: { channelType: string; token: string }[];
  persona: {
    name: string;
    soulMarkdown: string;
  };
  features: {
    commands: boolean;
    tts: boolean;
    ttsVoice?: string;
    sandbox: boolean;
    sandboxTimeout?: number;
    sessionScope: SessionScope;
  };
}

/**
 * Resolve host paths for Docker bind mounts.
 * If volume names are configured, inspect them to get actual host paths.
 * Otherwise, fall back to using the configured directories directly.
 */
async function resolveHostPaths(config: ReturnType<typeof getConfig>): Promise<{
  hostDataDir: string;
  hostSecretsDir: string;
}> {
  let hostDataDir = resolve(config.dataDir);
  let hostSecretsDir = resolve(config.secretsDir);

  if (config.dataVolumeName) {
    hostDataDir = await docker.getVolumeMountpoint(config.dataVolumeName);
  }
  if (config.secretsVolumeName) {
    hostSecretsDir = await docker.getVolumeMountpoint(config.secretsVolumeName);
  }

  return { hostDataDir, hostSecretsDir };
}

/**
 * Build and configure the Fastify server.
 */
export async function buildServer(): Promise<FastifyInstance> {
  const config = getConfig();

  // Resolve host paths for Docker bind mounts (inspect volumes if configured)
  const { hostDataDir, hostSecretsDir } = await resolveHostPaths(config);

  // Initialize database
  initDb(config.dataDir);

  const server = Fastify({
    logger: true,
  });

  // Run startup reconciliation
  const reconciliation = new ReconciliationService(docker, config.dataDir, server.log);
  const report = await reconciliation.reconcileOnStartup();
  server.log.info({ report }, 'Startup reconciliation complete');

  // Health check
  server.get('/health', () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // List all bots
  server.get('/api/bots', async () => {
    const bots = listBots();

    // Enrich with container status
    const enrichedBots = await Promise.all(
      bots.map(async (bot) => {
        const containerStatus = await docker.getContainerStatus(bot.hostname);
        return {
          ...bot,
          container_status: containerStatus,
        };
      })
    );

    return { bots: enrichedBots };
  });

  // Get single bot
  server.get<{ Params: { hostname: string } }>('/api/bots/:hostname', async (request, reply) => {
    const bot = getBotByHostname(request.params.hostname);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    const containerStatus = await docker.getContainerStatus(bot.hostname);

    return {
      ...bot,
      container_status: containerStatus,
    };
  });

  // Create bot
  server.post<{ Body: CreateBotBody }>('/api/bots', async (request, reply) => {
    const body = request.body;

    // Validate required fields
    if (!body.name) {
      reply.code(400);
      return { error: 'Missing required field: name' };
    }

    if (!body.hostname) {
      reply.code(400);
      return { error: 'Missing required field: hostname' };
    }

    // Validate hostname format (DNS-compatible, max 64 chars)
    if (!/^[a-z0-9-]{1,64}$/.test(body.hostname)) {
      reply.code(400);
      return { error: 'Hostname must be 1-64 lowercase letters, numbers, and hyphens' };
    }

    if (!body.providers || body.providers.length === 0) {
      reply.code(400);
      return { error: 'At least one provider is required' };
    }

    if (!body.channels || body.channels.length === 0) {
      reply.code(400);
      return { error: 'At least one channel is required' };
    }

    // Check for duplicate hostname
    if (getBotByHostname(body.hostname)) {
      reply.code(409);
      return { error: 'Bot with this hostname already exists' };
    }

    // Use primary provider or first provider
    const primaryProvider = body.providers.find(p => p.providerId === body.primaryProvider) ?? body.providers[0];
    const primaryChannel = body.channels[0];

    // Get next available port
    const port = getNextBotPort(config.botPortStart);
    const gatewayToken = randomBytes(32).toString('hex');

    // Create bot record
    const bot = createBot({
      name: body.name,
      hostname: body.hostname,
      ai_provider: primaryProvider.providerId,
      model: primaryProvider.model,
      channel_type: primaryChannel.channelType as 'telegram' | 'discord',
      port,
      gateway_token: gatewayToken,
    });

    try {
      // Store secrets for all providers
      for (const provider of body.providers) {
        const keyName = provider.providerId === primaryProvider.providerId
          ? 'AI_API_KEY'
          : `${provider.providerId.toUpperCase()}_API_KEY`;
        writeSecret(bot.hostname, keyName, provider.apiKey);
      }

      // Store channel tokens
      for (const channel of body.channels) {
        const tokenName = channel.channelType === 'telegram' ? 'TELEGRAM_TOKEN'
          : channel.channelType === 'discord' ? 'DISCORD_TOKEN'
          : `${channel.channelType.toUpperCase()}_TOKEN`;
        writeSecret(bot.hostname, tokenName, channel.token);
      }

      // Create workspace
      createBotWorkspace(config.dataDir, {
        botId: bot.id,
        botHostname: bot.hostname,
        botName: body.name,
        aiProvider: primaryProvider.providerId,
        apiKey: primaryProvider.apiKey,
        model: primaryProvider.model,
        channel: {
          type: primaryChannel.channelType as 'telegram' | 'discord',
          token: primaryChannel.token,
        },
        persona: {
          name: body.persona.name,
          identity: body.persona.soulMarkdown || '',
          description: body.emoji || '',
        },
        port,
      });

      // Build environment
      const hostWorkspacePath = join(hostDataDir, 'bots', bot.hostname);
      const hostSecretsPath = join(hostSecretsDir, bot.hostname);
      const hostSandboxPath = join(hostDataDir, 'bots', bot.hostname, 'sandbox');
      const environment = [
        `BOT_ID=${bot.id}`,
        `BOT_NAME=${body.name}`,
        `AI_PROVIDER=${primaryProvider.providerId}`,
        `AI_MODEL=${primaryProvider.model}`,
        `PORT=${port}`,
      ];

      // Add channel tokens
      for (const channel of body.channels) {
        if (channel.channelType === 'telegram') {
          environment.push(`TELEGRAM_BOT_TOKEN=${channel.token}`);
        } else if (channel.channelType === 'discord') {
          environment.push(`DISCORD_TOKEN=${channel.token}`);
        }
      }

      const containerId = await docker.createContainer(bot.hostname, bot.id, {
        image: config.openclawImage,
        environment,
        port,
        hostWorkspacePath,
        hostSecretsPath,
        hostSandboxPath,
        gatewayToken,
      });

      updateBot(bot.id, { container_id: containerId });
      await docker.startContainer(bot.hostname);
      updateBot(bot.id, { status: 'running' });

      const updatedBot = getBot(bot.id);
      reply.code(201);
      return updatedBot;
    } catch (err) {
      try { await docker.removeContainer(bot.hostname); } catch { /* ignore cleanup errors */ }
      deleteBotWorkspace(config.dataDir, bot.hostname);
      deleteBotSecrets(bot.hostname);
      deleteBot(bot.id);

      if (err instanceof ContainerError) {
        reply.code(500);
        return { error: `Container error: ${err.message}` };
      }
      throw err;
    }
  });

  // Delete bot
  server.delete<{ Params: { hostname: string } }>('/api/bots/:hostname', async (request, reply) => {
    const bot = getBotByHostname(request.params.hostname);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    try {
      // Remove container if exists
      await docker.removeContainer(bot.hostname);
    } catch (err) {
      if (err instanceof ContainerError && err.code !== 'NOT_FOUND') {
        reply.code(500);
        return { error: `Failed to remove container: ${err.message}` };
      }
    }

    // Delete workspace directory
    deleteBotWorkspace(config.dataDir, bot.hostname);

    // Delete secrets
    deleteBotSecrets(bot.hostname);

    // Delete bot record
    deleteBot(bot.id);

    return { success: true };
  });

  // Start bot
  server.post<{ Params: { hostname: string } }>('/api/bots/:hostname/start', async (request, reply) => {
    const bot = getBotByHostname(request.params.hostname);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    try {
      await docker.startContainer(bot.hostname);
      updateBot(bot.id, { status: 'running' });

      return { success: true, status: 'running' };
    } catch (err) {
      if (err instanceof ContainerError) {
        reply.code(500);
        return { error: `Failed to start container: ${err.message}` };
      }
      throw err;
    }
  });

  // Stop bot
  server.post<{ Params: { hostname: string } }>('/api/bots/:hostname/stop', async (request, reply) => {
    const bot = getBotByHostname(request.params.hostname);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    try {
      await docker.stopContainer(bot.hostname);
      updateBot(bot.id, { status: 'stopped' });

      return { success: true, status: 'stopped' };
    } catch (err) {
      if (err instanceof ContainerError) {
        reply.code(500);
        return { error: `Failed to stop container: ${err.message}` };
      }
      throw err;
    }
  });

  // Admin cleanup endpoint - removes orphaned containers, workspaces, and secrets
  server.post('/api/admin/cleanup', async () => {
    const cleanupReport = await reconciliation.cleanupOrphans();
    return { success: true, ...cleanupReport };
  });

  // Get orphan preview - shows what would be cleaned up without actually cleaning
  server.get('/api/admin/orphans', async () => {
    const report = await reconciliation.reconcileOnStartup();
    return {
      orphanedContainers: report.orphanedContainers,
      orphanedWorkspaces: report.orphanedWorkspaces,
      orphanedSecrets: report.orphanedSecrets,
      total: report.orphanedContainers.length + report.orphanedWorkspaces.length + report.orphanedSecrets.length,
    };
  });

  // Get container stats for all running bots
  server.get('/api/stats', async () => {
    const stats = await docker.getAllContainerStats();
    return { stats };
  });

  // Serve static dashboard files (if built)
  const dashboardDist = join(process.cwd(), 'dashboard', 'dist');
  if (existsSync(dashboardDist)) {
    await server.register(fastifyStatic, {
      root: dashboardDist,
      prefix: '/',
    });

    // SPA fallback - serve index.html for all non-API routes
    server.setNotFoundHandler(async (request, reply) => {
      if (!request.url.startsWith('/api/') && !request.url.startsWith('/health')) {
        return reply.sendFile('index.html');
      }
      reply.code(404);
      return { error: 'Not found' };
    });
  }

  return server;
}
