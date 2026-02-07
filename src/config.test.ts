import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all relevant env vars
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.DATA_DIR;
    delete process.env.SECRETS_DIR;
    delete process.env.DATA_VOLUME_NAME;
    delete process.env.SECRETS_VOLUME_NAME;
    delete process.env.OPENCLAW_IMAGE;
    delete process.env.OPENCLAW_GIT_TAG;
    delete process.env.BOT_PORT_START;
    delete process.env.PROXY_ADMIN_URL;
    delete process.env.PROXY_ADMIN_TOKEN;
    delete process.env.PROXY_ADMIN_TOKEN_FILE;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD_FILE;

    // Set valid admin password for tests (required, min 12 chars)
    process.env.ADMIN_PASSWORD = 'test-password-12chars';

    // Reset modules to get fresh config
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('should return default values', async () => {
    const { getConfig } = await import('./config.js');
    const config = getConfig();

    expect(config.port).toBe(7100);
    expect(config.host).toBe('0.0.0.0');
    expect(config.dataDir).toBe('./data');
    expect(config.secretsDir).toBe('./secrets');
    expect(config.dataVolumeName).toBeNull();
    expect(config.secretsVolumeName).toBeNull();
    expect(config.openclawImage).toBe('ghcr.io/openclaw/openclaw:latest');
    expect(config.openclawGitTag).toBe('main');
    expect(config.botPortStart).toBe(19000);
    expect(config.proxyAdminUrl).toBeNull();
    expect(config.proxyAdminToken).toBeNull();
  });

  it('should read PORT from env', async () => {
    process.env.PORT = '8080';
    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.port).toBe(8080);
  });

  it('should read HOST from env', async () => {
    process.env.HOST = '127.0.0.1';
    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.host).toBe('127.0.0.1');
  });

  it('should read DATA_DIR from env', async () => {
    process.env.DATA_DIR = '/var/lib/botmaker';
    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.dataDir).toBe('/var/lib/botmaker');
  });

  it('should read SECRETS_DIR from env', async () => {
    process.env.SECRETS_DIR = '/run/secrets';
    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.secretsDir).toBe('/run/secrets');
  });

  it('should read volume names from env', async () => {
    process.env.DATA_VOLUME_NAME = 'botmaker-data';
    process.env.SECRETS_VOLUME_NAME = 'botmaker-secrets';
    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.dataVolumeName).toBe('botmaker-data');
    expect(config.secretsVolumeName).toBe('botmaker-secrets');
  });

  it('should read OPENCLAW_IMAGE from env', async () => {
    process.env.OPENCLAW_IMAGE = 'openclaw:v2.0.0';
    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.openclawImage).toBe('openclaw:v2.0.0');
  });

  it('should read BOT_PORT_START from env', async () => {
    process.env.BOT_PORT_START = '20000';
    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.botPortStart).toBe(20000);
  });

  it('should use default for invalid PORT', async () => {
    process.env.PORT = 'not-a-number';
    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.port).toBe(7100);
  });

  it('should read PROXY_ADMIN_URL from env', async () => {
    process.env.PROXY_ADMIN_URL = 'http://proxy:9100';
    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.proxyAdminUrl).toBe('http://proxy:9100');
  });

  it('should read PROXY_ADMIN_TOKEN from env', async () => {
    process.env.PROXY_ADMIN_TOKEN = 'secret-token';
    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.proxyAdminToken).toBe('secret-token');
  });

  it('should throw if ADMIN_PASSWORD is missing', async () => {
    delete process.env.ADMIN_PASSWORD;
    const { getConfig } = await import('./config.js');
    expect(() => getConfig()).toThrow('ADMIN_PASSWORD or ADMIN_PASSWORD_FILE environment variable is required');
  });

  it('should throw if ADMIN_PASSWORD is too short', async () => {
    process.env.ADMIN_PASSWORD = 'short';
    const { getConfig } = await import('./config.js');
    expect(() => getConfig()).toThrow('ADMIN_PASSWORD must be at least 12 characters');
  });

  it('should read ADMIN_PASSWORD from env', async () => {
    process.env.ADMIN_PASSWORD = 'valid-password-12';
    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.adminPassword).toBe('valid-password-12');
  });
});
