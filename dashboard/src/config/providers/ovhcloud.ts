import type { ProviderConfig } from './types';

export const ovhcloud: ProviderConfig = {
  id: 'ovhcloud',
  label: 'OVHcloud',
  baseUrl: 'https://api.endpoints.ai.ovh.net/v1',
  defaultModel: 'ovhcloud-model',
  models: [
    { id: 'ovhcloud-model', label: 'OVHcloud Model' },
  ],
};
