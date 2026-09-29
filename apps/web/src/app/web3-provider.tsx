'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { wagmiAdapter } from '../lib/appkit';

const queryClient = new QueryClient();

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  if (!wagmiAdapter) return <>{children}</>;

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
