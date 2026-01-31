/**
 * Docker Service
 *
 * Container lifecycle management for BotMaker.
 * Wraps dockerode with domain-specific error handling and labeling.
 */

import Docker from 'dockerode';
import type { ContainerStatus, ContainerInfo, ContainerConfig } from '../types/container.js';
import { wrapDockerError } from './docker-errors.js';

/** Label used to identify BotMaker-managed containers */
const LABEL_MANAGED = 'botmaker.managed';
const LABEL_BOT_ID = 'botmaker.bot-id';

/**
 * Docker container lifecycle management service.
 * All containers are labeled for filtering and use bind-mounted secrets.
 */
export class DockerService {
  private docker: Docker;

  constructor() {
    // Uses /var/run/docker.sock by default
    this.docker = new Docker();
  }

  /**
   * Creates a new container for a bot.
   *
   * @param botId - UUID of the bot
   * @param config - Container configuration
   * @returns Container ID
   */
  async createContainer(botId: string, config: ContainerConfig): Promise<string> {
    const containerName = `botmaker-${botId}`;

    try {
      const container = await this.docker.createContainer({
        name: containerName,
        Image: config.image,
        Cmd: ['node', 'dist/index.js', 'gateway'],
        Env: [
          ...config.environment,
          `OPENCLAW_STATE_DIR=/app/botdata`,
          `OPENCLAW_GATEWAY_TOKEN=${config.gatewayToken}`,
        ],
        ExposedPorts: {
          [`${config.port}/tcp`]: {}
        },
        Labels: {
          [LABEL_MANAGED]: 'true',
          [LABEL_BOT_ID]: botId
        },
        HostConfig: {
          Binds: [
            `${config.hostSecretsPath}:/run/secrets:ro`,
            `${config.hostWorkspacePath}:/app/botdata:rw`
          ],
          PortBindings: {
            [`${config.port}/tcp`]: [{ HostPort: String(config.port) }]
          },
          RestartPolicy: {
            Name: 'unless-stopped'
          },
          NetworkMode: 'bridge'
        }
      });

      return container.id;
    } catch (err) {
      throw wrapDockerError(err, botId);
    }
  }

  /**
   * Starts a container for a bot.
   *
   * @param botId - UUID of the bot
   */
  async startContainer(botId: string): Promise<void> {
    const containerName = `botmaker-${botId}`;

    try {
      const container = this.docker.getContainer(containerName);
      await container.start();
    } catch (err) {
      const dockerErr = err as { statusCode?: number };

      // 304 = container already running, that's OK
      if (dockerErr.statusCode === 304) {
        return;
      }

      throw wrapDockerError(err, botId);
    }
  }

  /**
   * Stops a container for a bot.
   *
   * @param botId - UUID of the bot
   * @param timeout - Seconds to wait before killing (default: 10)
   */
  async stopContainer(botId: string, timeout = 10): Promise<void> {
    const containerName = `botmaker-${botId}`;

    try {
      const container = this.docker.getContainer(containerName);
      await container.stop({ t: timeout });
    } catch (err) {
      const dockerErr = err as { statusCode?: number };

      // 304 = container already stopped, that's OK
      if (dockerErr.statusCode === 304) {
        return;
      }

      throw wrapDockerError(err, botId);
    }
  }

  /**
   * Restarts a container for a bot.
   *
   * @param botId - UUID of the bot
   */
  async restartContainer(botId: string): Promise<void> {
    const containerName = `botmaker-${botId}`;

    try {
      const container = this.docker.getContainer(containerName);
      await container.restart();
    } catch (err) {
      throw wrapDockerError(err, botId);
    }
  }

  /**
   * Removes a container for a bot.
   * Stops the container first if running.
   *
   * @param botId - UUID of the bot
   */
  async removeContainer(botId: string): Promise<void> {
    const containerName = `botmaker-${botId}`;

    try {
      const container = this.docker.getContainer(containerName);

      // Try to stop first (ignore if already stopped or doesn't exist)
      try {
        await container.stop({ t: 10 });
      } catch (stopErr) {
        const dockerErr = stopErr as { statusCode?: number };
        // 304 = already stopped, 404 = doesn't exist
        if (dockerErr.statusCode !== 304 && dockerErr.statusCode !== 404) {
          throw stopErr;
        }
      }

      await container.remove();
    } catch (err) {
      throw wrapDockerError(err, botId);
    }
  }

  /**
   * Gets the status of a container for a bot.
   *
   * @param botId - UUID of the bot
   * @returns Container status or null if not found
   */
  async getContainerStatus(botId: string): Promise<ContainerStatus | null> {
    const containerName = `botmaker-${botId}`;

    try {
      const container = this.docker.getContainer(containerName);
      const info = await container.inspect();

      return {
        id: info.Id,
        state: info.State.Status as ContainerStatus['state'],
        running: info.State.Running,
        exitCode: info.State.ExitCode,
        startedAt: info.State.StartedAt,
        finishedAt: info.State.FinishedAt
      };
    } catch (err) {
      const dockerErr = err as { statusCode?: number };

      // 404 = container doesn't exist
      if (dockerErr.statusCode === 404) {
        return null;
      }

      throw wrapDockerError(err, botId);
    }
  }

  /**
   * Lists all BotMaker-managed containers.
   *
   * @returns Array of container info
   */
  async listManagedContainers(): Promise<ContainerInfo[]> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: {
        label: [`${LABEL_MANAGED}=true`]
      }
    });

    return containers.map(c => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') ?? '',
      botId: c.Labels[LABEL_BOT_ID] ?? '',
      state: c.State,
      status: c.Status
    }));
  }
}

export default DockerService;
