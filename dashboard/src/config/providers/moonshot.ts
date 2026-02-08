import type { ProviderConfig } from './types';

export const moonshot: ProviderConfig = {
  id: 'moonshot',
  label: 'Moonshot',
  baseUrl: 'https://api.moonshot.ai/v1',
  defaultModel: 'kimi-k2.5',
  models: [
    { id: 'kimi-k2.5', label: 'Kimi K2.5' },
  ],
};
