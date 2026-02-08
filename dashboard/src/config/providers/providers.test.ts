import { describe, it, expect } from 'vitest';
import { PROVIDERS, getProvider, getDefaultModel, getModels, getKeyHint } from './index';

describe('Provider configs', () => {
  it('should include grok in PROVIDERS', () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(ids).toContain('grok');
  });

  it('should include all expected providers', () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(['openai', 'anthropic', 'google', 'venice', 'openrouter', 'ollama', 'grok']);
  });

  it('getProvider returns correct config for grok', () => {
    const grok = getProvider('grok');
    expect(grok).toBeDefined();
    expect(grok?.id).toBe('grok');
    expect(grok?.label).toBe('Grok (xAI)');
    expect(grok?.baseUrl).toBe('https://api.x.ai/v1');
  });

  it('getDefaultModel returns grok-4-1-fast for grok', () => {
    expect(getDefaultModel('grok')).toBe('grok-4-1-fast');
  });

  it('getModels returns expected model list for grok', () => {
    const models = getModels('grok');
    const ids = models.map((m) => m.id);
    expect(ids).toEqual([
      'grok-4',
      'grok-4-heavy',
      'grok-4-1-fast',
      'grok-4-1-fast-reasoning',
      'grok-3',
      'grok-3-mini',
    ]);
  });

  it('getKeyHint returns xai-... for grok', () => {
    expect(getKeyHint('grok')).toBe('xai-...');
  });

  it('every provider has required fields', () => {
    for (const p of PROVIDERS) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.baseUrl).toBeTruthy();
      if (!p.dynamicModels) {
        expect(p.models.length).toBeGreaterThan(0);
        expect(p.defaultModel).toBeTruthy();
      }
    }
  });
});
