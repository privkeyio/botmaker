import type { ProviderConfig } from './types';

export const deepseek: ProviderConfig = {
  id: 'deepseek',
  label: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com/v1',
  keyHint: 'sk-...',
  defaultModel: 'deepseek-chat',
  models: [
    { id: 'deepseek-chat', label: 'DeepSeek Chat' },
    { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  ],
};
