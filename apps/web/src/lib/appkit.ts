'use client';

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { polygon } from '@reown/appkit/networks';
import { http } from 'viem';

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim() || '';
const defaultRpcUrl = process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com';

export const MULTI_WALLET_ENABLED = Boolean(projectId);

export const appKitNetworks = [polygon] as const;

export const wagmiAdapter =
  MULTI_WALLET_ENABLED && typeof window !== 'undefined'
    ? new WagmiAdapter({
        projectId,
        networks: appKitNetworks,
        ssr: false,
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
          url: 'https://crickx-3d806.web.app',
          icons: ['https://crickx-3d806.web.app/crickx-app-logo.svg'],
        },
        features: {
          analytics: false,
          email: false,
          socials: false,
          swaps: false,
          send: false,
        },
        themeMode: 'dark',
      })
    : null;
