import type { ProviderConfig } from './types';

export const togetherai: ProviderConfig = {
  id: 'togetherai',
  label: 'Together AI',
  baseUrl: 'https://api.together.xyz/v1',
  defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  models: [
    { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Instruct Turbo' },
    { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', label: 'Mixtral 8x7B' },
  ],
};
