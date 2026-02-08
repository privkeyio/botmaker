import type { ProviderConfig } from './types';

export const nebius: ProviderConfig = {
  id: 'nebius',
  label: 'Nebius',
  baseUrl: 'https://api.tokenfactory.nebius.com/v1',
  defaultModel: 'nebius-model',
  models: [
    { id: 'nebius-model', label: 'Nebius Model' },
  ],
};
