import type { ProviderConfig } from './types';

export const minimax: ProviderConfig = {
  id: 'minimax',
  label: 'MiniMax',
  baseUrl: 'https://api.minimax.chat/v1',
  defaultModel: 'MiniMax-M2.1',
  models: [
    { id: 'MiniMax-M2.1', label: 'MiniMax M2.1' },
  ],
};
