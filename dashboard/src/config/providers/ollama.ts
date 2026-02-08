import type { ProviderConfig } from './types';

export const ollama: ProviderConfig = {
  id: 'ollama',
  label: 'Ollama',
  baseUrl: 'http://localhost:11434/v1',
  defaultModel: '',
  models: [],
  dynamicModels: true,
  noAuth: true,
};
