import type { ProviderConfig } from './types';

export const fireworks: ProviderConfig = {
  id: 'fireworks',
  label: 'Fireworks',
  baseUrl: 'https://api.fireworks.ai/inference/v1',
  keyHint: 'fw_...',
  defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
  models: [
    { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', label: 'Llama 3.3 70B Instruct' },
    { id: 'accounts/fireworks/models/mixtral-8x7b-instruct', label: 'Mixtral 8x7B Instruct' },
  ],
};
