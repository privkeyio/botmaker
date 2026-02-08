import type { ProviderConfig } from './types';

export const scaleway: ProviderConfig = {
  id: 'scaleway',
  label: 'Scaleway',
  baseUrl: 'https://api.scaleway.ai/v1',
  defaultModel: 'scaleway-model',
  models: [
    { id: 'scaleway-model', label: 'Scaleway Model' },
  ],
};
