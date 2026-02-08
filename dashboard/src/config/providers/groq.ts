import type { ProviderConfig } from './types';

export const groq: ProviderConfig = {
  id: 'groq',
  label: 'Groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  keyHint: 'gsk_...',
  defaultModel: 'llama-3.3-70b-versatile',
  models: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
    { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  ],
};
