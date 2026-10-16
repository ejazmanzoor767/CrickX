'use client';

// Centralized multi-wallet provider bootstrap for the CrickX web client.

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { polygon, type AppKitNetwork } from '@reown/appkit/networks';
import { http } from 'viem';
import { createStorage } from 'wagmi';

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim() || '';
const defaultRpcUrl = process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com';

// MetaMask's Reown wallet ID lets AppKit offer its WalletConnect/deep-link route
// when Chrome on mobile does not expose an injected window.ethereum provider.
const METAMASK_WALLET_ID = 'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96';

export const MULTI_WALLET_ENABLED = Boolean(projectId);

export const appKitNetworks = [polygon] as [AppKitNetwork, ...AppKitNetwork[]];

export const wagmiAdapter =
  MULTI_WALLET_ENABLED && typeof window !== 'undefined'
    ? new WagmiAdapter({
        projectId,
        networks: appKitNetworks,
        ssr: false,
        storage: createStorage({ storage: window.localStorage }),
        transports: {
          [polygon.id]: http(defaultRpcUrl),
        },
      })
    : null;

export const appKit =
  wagmiAdapter && MULTI_WALLET_ENABLED
    ? createAppKit({
        adapters: [wagmiAdapter],
        projectId,
        networks: appKitNetworks,
        defaultNetwork: polygon,
        metadata: {
          name: 'CrickX',
          description: 'Fantasy cricket powered by CrickX.',
          url: 'https://crickxfantasy.site',
          icons: ['https://crickxfantasy.site/crickx-app-logo.svg'],
        },
        enableEIP6963: true,
        enableInjected: true,
        // Keep both desktop injected detection and mobile WalletConnect/deep links.
        enableWalletConnect: true,
        featuredWalletIds: [METAMASK_WALLET_ID],
        features: {
          analytics: false,
          email: false,
          socials: false,
          swaps: false,
          send: false,
          connectMethodsOrder: ['wallet'],
        },
        allWallets: 'SHOW',
        themeMode: 'dark',
      })
    : null;
