import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia as chain } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Swifter v2: Advanced Permission',
  projectId: 'bac9ebf8476d7c5e9efc867c6dd7345c',
  chains: [chain],
  autoConnect: false,
});
