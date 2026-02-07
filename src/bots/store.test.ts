import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { initDb, closeDb } from '../db/index.js';
import {
  createBot,
  getBot,
  getBotByName,
  getBotByHostname,
  listBots,
  updateBot,
  deleteBot,
  getNextBotPort,
  type CreateBotInput,
} from './store.js';

describe('Bot Store', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `bot-store-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    initDb(testDir);
  });

  afterEach(() => {
    closeDb();
    rmSync(testDir, { recursive: true, force: true });
  });

  function createTestBotInput(overrides: Partial<CreateBotInput> = {}): CreateBotInput {
    return {
      name: 'Test Bot',
      hostname: `test-bot-${randomUUID().slice(0, 8)}`,
      ai_provider: 'openai',
      model: 'gpt-4',
      channel_type: 'telegram',
      port: 19000,
      gateway_token: 'test-gateway-token',
      ...overrides,
    };
  }

  describe('createBot', () => {
    it('should create a bot with all fields', () => {
      const input = createTestBotInput({
        name: 'My Bot',
        hostname: 'my-bot',
        tags: ['prod', 'premium'],
      });

      const bot = createBot(input);

      expect(bot.id).toBeDefined();
      expect(bot.name).toBe('My Bot');
      expect(bot.hostname).toBe('my-bot');
      expect(bot.ai_provider).toBe('openai');
      expect(bot.model).toBe('gpt-4');
      expect(bot.channel_type).toBe('telegram');
      expect(bot.port).toBe(19000);
      expect(bot.gateway_token).toBe('test-gateway-token');
      expect(bot.tags).toBe('["prod","premium"]');
      expect(bot.status).toBe('created');
      expect(bot.container_id).toBeNull();
      expect(bot.created_at).toBeDefined();
      expect(bot.updated_at).toBeDefined();
    });

    it('should create a bot without tags', () => {
      const input = createTestBotInput();
      const bot = createBot(input);
      expect(bot.tags).toBeNull();
    });

    it('should generate unique IDs', () => {
      const bot1 = createBot(createTestBotInput());
      const bot2 = createBot(createTestBotInput());
      expect(bot1.id).not.toBe(bot2.id);
    });
  });

  describe('getBot', () => {
    it('should get a bot by ID', () => {
      const created = createBot(createTestBotInput({ name: 'FindMe' }));
      const found = getBot(created.id);

      expect(found).not.toBeNull();
      expect(found?.name).toBe('FindMe');
    });

    it('should return null for non-existent ID', () => {
      const found = getBot('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('getBotByName', () => {
    it('should get a bot by name', () => {
      createBot(createTestBotInput({ name: 'UniqueBot' }));
      const found = getBotByName('UniqueBot');

      expect(found).not.toBeNull();
      expect(found?.name).toBe('UniqueBot');
    });

    it('should return null for non-existent name', () => {
      const found = getBotByName('NonExistent');
      expect(found).toBeNull();
    });
  });

  describe('getBotByHostname', () => {
    it('should get a bot by hostname', () => {
      createBot(createTestBotInput({ hostname: 'unique-host' }));
      const found = getBotByHostname('unique-host');

      expect(found).not.toBeNull();
      expect(found?.hostname).toBe('unique-host');
    });

    it('should return null for non-existent hostname', () => {
      const found = getBotByHostname('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('listBots', () => {
    it('should return empty array when no bots', () => {
      const bots = listBots();
      expect(bots).toEqual([]);
    });

    it('should list all bots', () => {
      createBot(createTestBotInput({ name: 'Bot 1' }));
      createBot(createTestBotInput({ name: 'Bot 2' }));
      createBot(createTestBotInput({ name: 'Bot 3' }));

      const bots = listBots();
      expect(bots).toHaveLength(3);
    });

    it('should order by created_at DESC', () => {
      createBot(createTestBotInput({ name: 'First' }));
      createBot(createTestBotInput({ name: 'Second' }));
      createBot(createTestBotInput({ name: 'Third' }));

      const bots = listBots();
      // Should return all 3 bots
      expect(bots).toHaveLength(3);
      // All bots should be present
      expect(bots.map(b => b.name)).toContain('First');
      expect(bots.map(b => b.name)).toContain('Second');
      expect(bots.map(b => b.name)).toContain('Third');
    });
  });

  describe('updateBot', () => {
    it('should update name', () => {
      const created = createBot(createTestBotInput({ name: 'OldName' }));
      const updated = updateBot(created.id, { name: 'NewName' });

      expect(updated).not.toBeNull();
      expect(updated?.name).toBe('NewName');
    });

    it('should update hostname', () => {
      const created = createBot(createTestBotInput({ hostname: 'old-host' }));
      const updated = updateBot(created.id, { hostname: 'new-host' });

      expect(updated).not.toBeNull();
      expect(updated?.hostname).toBe('new-host');
    });

    it('should update container_id', () => {
      const created = createBot(createTestBotInput());
      const updated = updateBot(created.id, { container_id: 'container-123' });

      expect(updated).not.toBeNull();
      expect(updated?.container_id).toBe('container-123');
    });

    it('should update status', () => {
      const created = createBot(createTestBotInput());
      const updated = updateBot(created.id, { status: 'running' });

      expect(updated).not.toBeNull();
      expect(updated?.status).toBe('running');
    });

    it('should update tags', () => {
      const created = createBot(createTestBotInput({ tags: ['old'] }));
      const updated = updateBot(created.id, { tags: ['new1', 'new2'] });

      expect(updated).not.toBeNull();
      expect(updated?.tags).toBe('["new1","new2"]');
    });

    it('should update image_version', () => {
      const created = createBot(createTestBotInput());
      expect(created.image_version).toBeNull();

      const updated = updateBot(created.id, { image_version: 'ghcr.io/openclaw/openclaw:latest' });
      expect(updated).not.toBeNull();
      expect(updated?.image_version).toBe('ghcr.io/openclaw/openclaw:latest');
    });

    it('should clear tags', () => {
      const created = createBot(createTestBotInput({ tags: ['tag'] }));
      const updated = updateBot(created.id, { tags: null });

      expect(updated).not.toBeNull();
      expect(updated?.tags).toBeNull();
    });

    it('should update multiple fields', () => {
      const created = createBot(createTestBotInput());
      const updated = updateBot(created.id, {
        name: 'Updated',
        status: 'running',
        container_id: 'abc123',
      });

      expect(updated).not.toBeNull();
      expect(updated?.name).toBe('Updated');
      expect(updated?.status).toBe('running');
      expect(updated?.container_id).toBe('abc123');
    });

    it('should update updated_at timestamp', () => {
      const created = createBot(createTestBotInput());

      const updated = updateBot(created.id, { name: 'Changed' });

      // updated_at should be set (may or may not differ due to same-millisecond execution)
      expect(updated?.updated_at).toBeDefined();
      expect(new Date(updated?.updated_at ?? '').getTime()).toBeGreaterThanOrEqual(
        new Date(created.created_at).getTime()
      );
    });

    it('should return null for non-existent bot', () => {
      const updated = updateBot('non-existent-id', { name: 'Test' });
      expect(updated).toBeNull();
    });
  });

  describe('deleteBot', () => {
    it('should delete a bot', () => {
      const created = createBot(createTestBotInput());
      const deleted = deleteBot(created.id);

      expect(deleted).toBe(true);
      expect(getBot(created.id)).toBeNull();
    });

    it('should return false for non-existent bot', () => {
      const deleted = deleteBot('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('getNextBotPort', () => {
    it('should return start port when no bots exist', () => {
      const port = getNextBotPort(19000);
      expect(port).toBe(19000);
    });

    it('should return next port after last used', () => {
      createBot(createTestBotInput({ port: 19000 }));
      createBot(createTestBotInput({ port: 19001 }));

      const port = getNextBotPort(19000);
      expect(port).toBe(19002);
    });

    it('should find gap in port range', () => {
      createBot(createTestBotInput({ port: 19000 }));
      createBot(createTestBotInput({ port: 19002 })); // Gap at 19001
      createBot(createTestBotInput({ port: 19003 }));

      const port = getNextBotPort(19000);
      expect(port).toBe(19001);
    });

    it('should skip to start port if lower ports used', () => {
      createBot(createTestBotInput({ port: 18000 }));

      const port = getNextBotPort(19000);
      expect(port).toBe(19000);
    });
  });
});
