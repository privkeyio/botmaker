import type { ProviderConfig } from './types';

export const nvidia: ProviderConfig = {
  id: 'nvidia',
  label: 'NVIDIA',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  keyHint: 'nvapi-...',
  defaultModel: 'nvidia/llama-3.1-nemotron-70b-instruct',
  models: [
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Llama 3.1 Nemotron 70B' },
  ],
};
