import type { ProviderConfig } from './types';

export const perplexity: ProviderConfig = {
  id: 'perplexity',
  label: 'Perplexity',
  baseUrl: 'https://api.perplexity.ai',
  keyHint: 'pplx-...',
  defaultModel: 'sonar-pro',
  models: [
    { id: 'sonar-pro', label: 'Sonar Pro' },
    { id: 'sonar', label: 'Sonar' },
  ],
};
