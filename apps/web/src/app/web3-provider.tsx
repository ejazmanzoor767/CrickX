'use client';

import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { wagmiAdapter } from '../lib/appkit';
import { restorePersistedWalletConnection } from '../lib/web3';

const queryClient = new QueryClient();

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!wagmiAdapter) return;
    void restorePersistedWalletConnection();
  }, []);

  if (!wagmiAdapter) return <>{children}</>;

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
