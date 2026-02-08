import { describe, it, expect } from 'vitest';
import { PROVIDERS, PROVIDER_CATEGORIES, getProvider, getDefaultModel, getModels, getKeyHint } from './index';

describe('Provider configs', () => {
  it('should include all expected providers', () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(ids).toEqual([
      'openai', 'anthropic', 'google', 'deepseek', 'mistral',
      'groq', 'cerebras', 'fireworks',
      'openrouter', 'venice', 'togetherai', 'deepinfra',
      'perplexity', 'nvidia', 'moonshot', 'grok',
      'scaleway', 'nebius', 'ovhcloud', 'huggingface', 'minimax',
      'ollama',
    ]);
  });

  it('should have 22 providers', () => {
    expect(PROVIDERS).toHaveLength(22);
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

  it('every provider is in exactly one category', () => {
    for (const p of PROVIDERS) {
      const cats = PROVIDER_CATEGORIES.filter((c) => c.providerIds.includes(p.id));
      expect(cats, `${p.id} should be in exactly one category`).toHaveLength(1);
    }
  });

  it('every category provider ID exists in PROVIDERS', () => {
    const providerIds = new Set(PROVIDERS.map((p) => p.id));
    for (const cat of PROVIDER_CATEGORIES) {
      for (const id of cat.providerIds) {
        expect(providerIds.has(id), `category "${cat.id}" references unknown provider "${id}"`).toBe(true);
      }
    }
  });
});
