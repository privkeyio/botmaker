import type { ProviderConfig } from './types';

export const mistral: ProviderConfig = {
  id: 'mistral',
  label: 'Mistral',
  baseUrl: 'https://api.mistral.ai/v1',
  defaultModel: 'mistral-large-latest',
  models: [
    { id: 'mistral-large-latest', label: 'Mistral Large' },
    { id: 'mistral-medium-latest', label: 'Mistral Medium' },
    { id: 'mistral-small-latest', label: 'Mistral Small' },
    { id: 'codestral-latest', label: 'Codestral' },
  ],
};
