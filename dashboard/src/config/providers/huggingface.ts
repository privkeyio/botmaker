import type { ProviderConfig } from './types';

export const huggingface: ProviderConfig = {
  id: 'huggingface',
  label: 'Hugging Face',
  baseUrl: 'https://api-inference.huggingface.co/v1',
  keyHint: 'hf_...',
  defaultModel: 'huggingface-model',
  models: [
    { id: 'huggingface-model', label: 'Hugging Face Model' },
  ],
};
