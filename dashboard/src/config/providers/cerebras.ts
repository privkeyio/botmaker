import type { ProviderConfig } from './types';

export const cerebras: ProviderConfig = {
  id: 'cerebras',
  label: 'Cerebras',
  baseUrl: 'https://api.cerebras.ai/v1',
  defaultModel: 'llama-3.3-70b',
  models: [
    { id: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b', label: 'Llama 3.1 8B' },
  ],
};
