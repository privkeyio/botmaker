import type { ProviderConfig } from './types';

export const deepinfra: ProviderConfig = {
  id: 'deepinfra',
  label: 'Deep Infra',
  baseUrl: 'https://api.deepinfra.com/v1',
  defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
  models: [
    { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B Instruct' },
    { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', label: 'Mixtral 8x7B' },
  ],
};
