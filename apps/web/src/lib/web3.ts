'use client';

import { createPublicClient, createWalletClient, custom, formatUnits, http, isAddress, parseUnits, type Address } from 'viem';
import { getAccount, getWalletClient, switchChain } from '@wagmi/core';
import { appKit, MULTI_WALLET_ENABLED, wagmiAdapter } from './appkit';
import { polygon } from 'viem/chains';

export const CRX_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_CRX_TOKEN_ADDRESS || '') as Address;
export const CRX_CONTEST_POOL_ADDRESS = (process.env.NEXT_PUBLIC_CRX_CONTEST_POOL_ADDRESS || '') as Address;
export const POLYGON_CHAIN_ID = 137;
export const DEFAULT_RPC_URL = process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com';

const CRX_ABI = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

const POOL_ABI = [
  { type: 'function', name: 'stage', stateMutability: 'view', inputs: [{ name: 'contestId', type: 'uint256' }], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'participantCount', stateMutability: 'view', inputs: [{ name: 'contestId', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalPool', stateMutability: 'view', inputs: [{ name: 'contestId', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'hasEntered', stateMutability: 'view', inputs: [{ name: 'contestId', type: 'uint256' }, { name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const;

const publicClient = createPublicClient({ chain: polygon, transport: http(DEFAULT_RPC_URL) });
const readContract: any = publicClient.readContract.bind(publicClient);

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: Function;
  removeListener?: Function;
};

function getBrowserEthereumProvider(): EthereumProvider {
  if (typeof window === 'undefined') {
    throw new Error('Wallet connection is only available in the browser.');
  }

  const provider = (window as typeof window & { ethereum?: EthereumProvider }).ethereum;
  if (!provider) {
    throw new Error('No compatible Polygon wallet extension was found. Use the wallet picker to connect a supported wallet.');
  }

  return provider;
}

async function getEthereumProvider(connect = false): Promise<EthereumProvider> {
  const provider = getBrowserEthereumProvider();
  if (connect) await provider.request({ method: 'eth_requestAccounts' });
  return provider;
}

function getWagmiConfig() {
  if (!MULTI_WALLET_ENABLED || !wagmiAdapter) return null;
  return wagmiAdapter.wagmiConfig;
}

async function waitForWalletConnection() {
  const config = getWagmiConfig();
  if (!config) throw new Error('Multi-wallet connection is not configured.');

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const account = getAccount(config);
    if (account.isConnected && account.address) return account;
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error('Wallet connection was not completed. Please select a wallet and try again.');
}

async function getConnectedWalletClient() {
  const config = getWagmiConfig();

  if (config) {
    const account = getAccount(config);
    if (!account.isConnected || !account.address) throw new Error('Connect a wallet first.');

    if (account.chainId !== POLYGON_CHAIN_ID) await switchToPolygon();

    const walletClient = await getWalletClient(config);
    if (!walletClient?.account) throw new Error('The connected wallet is unavailable. Please reconnect your wallet.');
    return walletClient;
  }

  const ethereum = await getEthereumProvider(true);
  const baseWalletClient = createWalletClient({ chain: polygon, transport: custom(ethereum as any) });
  const [account] = await baseWalletClient.requestAddresses();
  if (!account) throw new Error('No wallet account was selected.');
  return createWalletClient({
    account,
    chain: polygon,
    transport: custom(ethereum as any),
  });
}

export function shortAddress(address?: string | null) { return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''; }

export async function switchToPolygon() {
  const config = getWagmiConfig();

  if (config) {
    const account = getAccount(config);
    if (!account.isConnected || !account.address) throw new Error('Connect a wallet first.');
    if (account.chainId === POLYGON_CHAIN_ID) return;
    await switchChain(config, { chainId: POLYGON_CHAIN_ID });
    return;
  }

  const provider = await getEthereumProvider(true);
  const chainId = await provider.request({ method: 'eth_chainId' });
  if (chainId === '0x89') return;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: number }).code : undefined;
    if (code !== 4902) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: '0x89',
        chainName: 'Polygon Mainnet',
        nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
        rpcUrls: [DEFAULT_RPC_URL],
        blockExplorerUrls: ['https://polygonscan.com'],
      }],
    });
  }
}

export async function changeWallet(currentAddress?: Address) {
  const config = getWagmiConfig();

  if (config && appKit) {
    const previousAddress = currentAddress || getAccount(config).address || null;

    return new Promise<Address>(async (resolve, reject) => {
      let sawOpen = false;
      let settled = false;
      let interval: ReturnType<typeof setInterval> | null = null;
      let unsubscribe: (() => void) | null = null;

      const cleanup = () => {
        if (interval) clearInterval(interval);
        if (unsubscribe) unsubscribe();
      };

      const finish = (value?: Address, error?: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else if (value) resolve(value);
        else reject(new Error('Wallet selection was cancelled.'));
      };

      unsubscribe = appKit.subscribeState(state => {
        if (state.open) {
          sawOpen = true;
          return;
        }

        if (!sawOpen) return;

        const account = getAccount(config);
        if (account.isConnected && account.address) {
          finish(account.address as Address);
        } else {
          finish(undefined, new Error('Wallet selection was cancelled.'));
        }
      });

      interval = setInterval(() => {
        const account = getAccount(config);
        if (!account.isConnected || !account.address) return;
        if (!previousAddress || account.address.toLowerCase() !== previousAddress.toLowerCase()) {
          finish(account.address as Address);
        }
      }, 250);

      try {
        await appKit.open({ view: 'AllWallets' });
      } catch (error) {
        finish(undefined, error instanceof Error ? error : new Error('Unable to open the wallet picker.'));
      }
    });
  }

  return connectWallet();
}

export async function connectWallet() {
  const config = getWagmiConfig();

  if (config && appKit) {
    const current = getAccount(config);
    if (!current.isConnected || !current.address) {
      await appKit.open({ view: 'Connect' });
    }

    const account = await waitForWalletConnection();
    if (account.chainId !== POLYGON_CHAIN_ID) await switchToPolygon();
    return account.address as Address;
  }

  const provider = await getEthereumProvider(true);
  if ((await provider.request({ method: 'eth_chainId' })) !== '0x89') await switchToPolygon();
  const accounts = await provider.request({ method: 'eth_accounts' }) as unknown;
  const address = Array.isArray(accounts) ? accounts[0] : undefined;
  if (typeof address !== 'string' || !isAddress(address)) throw new Error('No wallet account was selected.');
  return address as Address;
}

export async function signContestJoinMessage(message: string) {
  const walletClient = await getConnectedWalletClient();
  const account = walletClient.account;
  if (!account) throw new Error('The connected wallet is unavailable. Please reconnect your wallet.');

  const signature = await walletClient.signMessage({ account, message });
  return { account: account.address, signature };
}

export async function getCurrentWallet() {
  if (typeof window === 'undefined') return null;

  const config = getWagmiConfig();
  if (config) {
    try {
      const account = getAccount(config);
      return account.isConnected && account.address && isAddress(account.address)
        ? account.address as Address
        : null;
    } catch {
      return null;
    }
  }

  try {
    const provider = getBrowserEthereumProvider();
    const accounts = await provider.request({ method: 'eth_accounts' }) as unknown;
    const address = Array.isArray(accounts) ? accounts[0] : undefined;
    return typeof address === 'string' && isAddress(address) ? address as Address : null;
  } catch {
    return null;
  }
}

export async function getConnectedWalletName() {
  const config = getWagmiConfig();
  if (config) {
    try {
      const account = getAccount(config);
      return account.connector?.name || 'Wallet';
    } catch {
      return 'Wallet';
    }
  }

  return 'Browser wallet';
}

export async function readCrxWallet(address: Address) {
  if (!CRX_TOKEN_ADDRESS) throw new Error('CRX token address is not configured.');
  const decimals = Number(await readContract({ address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'decimals' }));
  const balanceRaw = await readContract({ address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'balanceOf', args: [address] });
  const allowanceRaw = CRX_CONTEST_POOL_ADDRESS ? await readContract({ address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'allowance', args: [address, CRX_CONTEST_POOL_ADDRESS] }) : 0n;
  return { address, decimals, balanceRaw, allowanceRaw, balance: Number(formatUnits(balanceRaw, decimals)), allowance: Number(formatUnits(allowanceRaw, decimals)) };
}

export async function approveContestPool(_amount: string | number, _decimals = 18) { throw new Error('Contest entry is free. User CRX approval is not required.'); }

export async function joinOnchainContest(_contestId: number) { throw new Error('Contest entry is free. No CRX blockchain payment is required.'); }

export async function sendCrx(to: string, amount: string, decimals = 18) {
  if (!CRX_TOKEN_ADDRESS) throw new Error('CRX token address is not configured.');
  if (!isAddress(to)) throw new Error('Enter a valid wallet address.');

  const walletClient = await getConnectedWalletClient();
  const account = walletClient.account;
  if (!account) throw new Error('The connected wallet is unavailable. Please reconnect your wallet.');

  const hash = await walletClient.writeContract({
    account,
    chain: polygon,
    address: CRX_TOKEN_ADDRESS,
    abi: CRX_ABI,
    functionName: 'transfer',
    args: [to as Address, parseUnits(amount, decimals)],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function readOnchainContest(contestId: number) {
  if (!CRX_CONTEST_POOL_ADDRESS) throw new Error('CRX contest pool address is not configured.');
  if (!CRX_TOKEN_ADDRESS) throw new Error('CRX token address is not configured.');
  const [stage, participantCount, totalPoolRaw, decimals] = await Promise.all([
    readContract({ address: CRX_CONTEST_POOL_ADDRESS, abi: POOL_ABI, functionName: 'stage', args: [BigInt(contestId)] }),
    readContract({ address: CRX_CONTEST_POOL_ADDRESS, abi: POOL_ABI, functionName: 'participantCount', args: [BigInt(contestId)] }),
    readContract({ address: CRX_CONTEST_POOL_ADDRESS, abi: POOL_ABI, functionName: 'totalPool', args: [BigInt(contestId)] }),
    readContract({ address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'decimals' }),
  ]);
  return {
    entryFee: 0,
    stage: Number(stage),
    participantCount: Number(participantCount),
    totalPool: Number(formatUnits(totalPoolRaw, Number(decimals))),
    decimals: Number(decimals),
  };
}
