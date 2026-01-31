/**
 * BotMaker Entry Point
 *
 * Web UI for creating and managing OpenClaw bots.
 */

import { buildServer } from './server.js';
import { getConfig } from './config.js';
import { closeDb } from './db/index.js';
import { listBots, updateBot } from './bots/store.js';

async function main(): Promise<void> {
  const config = getConfig();

  console.log('Starting BotMaker...');
  console.log(`  Port: ${config.port}`);
  console.log(`  Data directory: ${config.dataDir}`);
  console.log(`  Secrets directory: ${config.secretsDir}`);
  console.log(`  OpenClaw image: ${config.openclawImage}`);

  const server = await buildServer();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');

    // Mark running bots as stopped in DB
    // (containers persist via restart policy, but DB should reflect shutdown)
    const running = listBots().filter(b => b.status === 'running');
    for (const bot of running) {
      updateBot(bot.id, { status: 'stopped' });
    }

    await server.close();
    closeDb();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  try {
    await server.listen({ port: config.port, host: config.host });
    console.log(`\nBotMaker running at http://${config.host}:${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main().catch(console.error);
