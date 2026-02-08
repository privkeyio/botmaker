export interface ProviderCategory {
  id: string;
  label: string;
  providerIds: string[];
}

export const PROVIDER_CATEGORIES: ProviderCategory[] = [
  { id: 'major', label: 'Major Providers', providerIds: ['openai', 'anthropic', 'google', 'deepseek', 'mistral'] },
  { id: 'fast-inference', label: 'Fast Inference', providerIds: ['groq', 'cerebras', 'fireworks'] },
  { id: 'aggregators', label: 'Aggregators', providerIds: ['openrouter', 'venice', 'togetherai', 'deepinfra'] },
  { id: 'specialized', label: 'Specialized', providerIds: ['perplexity', 'nvidia', 'moonshot', 'grok'] },
  { id: 'regional', label: 'Regional / Infrastructure', providerIds: ['scaleway', 'nebius', 'ovhcloud', 'huggingface', 'minimax'] },
  { id: 'local', label: 'Local', providerIds: ['ollama'] },
];
