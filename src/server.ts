/**
 * Fastify Server
 *
 * API routes for bot management.
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

import { getConfig } from './config.js';
import { initDb } from './db/index.js';
import {
  createBot,
  getBot,
  getBotByName,
  listBots,
  updateBot,
  deleteBot,
  getNextBotPort,
} from './bots/store.js';
import { createBotWorkspace, getBotWorkspacePath } from './bots/templates.js';
import { writeSecret, deleteBotSecrets } from './secrets/manager.js';
import { DockerService } from './services/DockerService.js';
import { ContainerError } from './services/docker-errors.js';
import type { BotStatus } from './types/bot.js';

const docker = new DockerService();

interface CreateBotBody {
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

/**
 * Build and configure the Fastify server.
 */
export async function buildServer(): Promise<FastifyInstance> {
  const config = getConfig();

  // Initialize database
  initDb(config.dataDir);

  const server = Fastify({
    logger: true,
  });

  // Health check
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // List all bots
  server.get('/api/bots', async () => {
    const bots = listBots();

    // Enrich with container status
    const enrichedBots = await Promise.all(
      bots.map(async (bot) => {
        const containerStatus = await docker.getContainerStatus(bot.id);
        return {
          ...bot,
          container_status: containerStatus,
        };
      })
    );

    return { bots: enrichedBots };
  });

  // Get single bot
  server.get<{ Params: { id: string } }>('/api/bots/:id', async (request, reply) => {
    const bot = getBot(request.params.id);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    const containerStatus = await docker.getContainerStatus(bot.id);

    return {
      ...bot,
      container_status: containerStatus,
    };
  });

  // Create bot
  server.post<{ Body: CreateBotBody }>('/api/bots', async (request, reply) => {
    const body = request.body;

    // Validate required fields
    if (!body.name || !body.ai_provider || !body.model || !body.channel_type) {
      reply.code(400);
      return { error: 'Missing required fields: name, ai_provider, model, channel_type' };
    }

    if (!body.channel_token || !body.api_key) {
      reply.code(400);
      return { error: 'Missing required secrets: channel_token, api_key' };
    }

    if (!body.persona?.name || !body.persona?.identity || !body.persona?.description) {
      reply.code(400);
      return { error: 'Missing persona fields: name, identity, description' };
    }

    // Check for duplicate name
    if (getBotByName(body.name)) {
      reply.code(409);
      return { error: 'Bot with this name already exists' };
    }

    // Create bot record
    const bot = createBot({
      name: body.name,
      ai_provider: body.ai_provider,
      model: body.model,
      channel_type: body.channel_type,
    });

    try {
      // Store secrets
      writeSecret(bot.id, 'AI_API_KEY', body.api_key);

      if (body.channel_type === 'telegram') {
        writeSecret(bot.id, 'TELEGRAM_TOKEN', body.channel_token);
      } else if (body.channel_type === 'discord') {
        writeSecret(bot.id, 'DISCORD_TOKEN', body.channel_token);
      }

      // Get next available port
      const port = getNextBotPort(config.botPortStart);

      // Create workspace
      createBotWorkspace(config.dataDir, {
        botId: bot.id,
        botName: body.name,
        aiProvider: body.ai_provider,
        model: body.model,
        channel: {
          type: body.channel_type,
          token: body.channel_token,
        },
        persona: body.persona,
        port,
      });

      // Create container
      // Use host paths for Docker bind mounts (Docker daemon runs on host, not in container)
      const hostWorkspacePath = resolve(getBotWorkspacePath(config.hostDataDir, bot.id));
      const hostSecretsPath = resolve(join(config.hostSecretsDir, bot.id));
      const gatewayToken = randomBytes(32).toString('hex');
      const containerId = await docker.createContainer(bot.id, {
        image: config.openclawImage,
        environment: [
          `BOT_ID=${bot.id}`,
          `BOT_NAME=${body.name}`,
          `AI_PROVIDER=${body.ai_provider}`,
          `AI_MODEL=${body.model}`,
          `PORT=${port}`,
        ],
        port,
        hostWorkspacePath,
        hostSecretsPath,
        gatewayToken,
      });

      // Update bot with container ID
      updateBot(bot.id, { container_id: containerId });

      // Start container
      await docker.startContainer(bot.id);
      updateBot(bot.id, { status: 'running' });

      const updatedBot = getBot(bot.id);
      reply.code(201);
      return updatedBot;
    } catch (err) {
      // Cleanup on failure
      deleteBotSecrets(bot.id);
      deleteBot(bot.id);

      if (err instanceof ContainerError) {
        reply.code(500);
        return { error: `Container error: ${err.message}` };
      }

      throw err;
    }
  });

  // Delete bot
  server.delete<{ Params: { id: string } }>('/api/bots/:id', async (request, reply) => {
    const bot = getBot(request.params.id);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    try {
      // Remove container if exists
      await docker.removeContainer(bot.id);
    } catch (err) {
      if (err instanceof ContainerError && err.code !== 'NOT_FOUND') {
        reply.code(500);
        return { error: `Failed to remove container: ${err.message}` };
      }
    }

    // Delete secrets
    deleteBotSecrets(bot.id);

    // Delete bot record
    deleteBot(bot.id);

    return { success: true };
  });

  // Start bot
  server.post<{ Params: { id: string } }>('/api/bots/:id/start', async (request, reply) => {
    const bot = getBot(request.params.id);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    try {
      await docker.startContainer(bot.id);
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
  server.post<{ Params: { id: string } }>('/api/bots/:id/stop', async (request, reply) => {
    const bot = getBot(request.params.id);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    try {
      await docker.stopContainer(bot.id);
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
