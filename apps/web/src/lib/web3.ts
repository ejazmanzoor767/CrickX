'use client';

import { createPublicClient, createWalletClient, custom, formatUnits, http, isAddress, parseUnits, type Address } from 'viem';
import { createEVMClient } from '@metamask/connect-evm';
import { polygon } from 'viem/chains';

export const CRX_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_CRX_TOKEN_ADDRESS || '0x0706508638A6cBaaC482f971326299eCdd2D0731') as Address;
export const CRX_CONTEST_POOL_ADDRESS = (process.env.NEXT_PUBLIC_CRX_CONTEST_POOL_ADDRESS || '') as Address;
export const POLYGON_CHAIN_ID = 137;
export const DEFAULT_RPC_URL = process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com';

const CRX_ABI = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

const POOL_ABI = [
  { type: 'function', name: 'entryFee', stateMutability: 'view', inputs: [{ name: 'contestId', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'stage', stateMutability: 'view', inputs: [{ name: 'contestId', type: 'uint256' }], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'participantCount', stateMutability: 'view', inputs: [{ name: 'contestId', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'hasEntered', stateMutability: 'view', inputs: [{ name: 'contestId', type: 'uint256' }, { name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'joinContest', stateMutability: 'nonpayable', inputs: [{ name: 'contestId', type: 'uint256' }], outputs: [] },
] as const;

const publicClient = createPublicClient({ chain: polygon, transport: http(DEFAULT_RPC_URL) });
const readContract: any = publicClient.readContract.bind(publicClient);

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: Function;
  removeListener?: Function;
};

type EvmClient = Awaited<ReturnType<typeof createEVMClient>>;
let metamaskClientPromise: Promise<EvmClient> | null = null;

async function getMetaMaskClient(): Promise<EvmClient> {
  if (typeof window === 'undefined') throw new Error('Wallet connection is only available in the browser.');
  if (!metamaskClientPromise) {
    metamaskClientPromise = createEVMClient({
      dapp: { name: 'CrickX', url: window.location.origin, iconUrl: `${window.location.origin}/crickx-app-logo.svg` },
      api: { supportedNetworks: { '0x89': DEFAULT_RPC_URL, '0x1': 'https://ethereum-rpc.publicnode.com' } },
      // Keep the SDK provider hidden until connect() establishes a session.
      // MetaMask Connect then selects the proper desktop extension or mobile
      // deeplink + relay transport automatically.
      skipAutoAnnounce: true,
      mobile: {
        preferredOpenLink: (deeplink: string) => {
          window.location.href = deeplink;
        },
      },
      analytics: { enabled: false },
    });
  }
  return metamaskClientPromise;
}

async function getEthereumProvider(connect = false): Promise<EthereumProvider> {
  const client = await getMetaMaskClient();
  if (connect && client.status !== 'connected') await client.connect({ chainIds: ['0x89', '0x1'] });
  if (client.status !== 'connected') throw new Error('MetaMask connection was not established. Please try again.');
  return client.getProvider() as EthereumProvider;
}

export function shortAddress(address?: string | null) { return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''; }

export async function switchToPolygon() {
  const client = await getMetaMaskClient();
  if (client.status !== 'connected') await client.connect({ chainIds: ['0x89', '0x1'] });
  if (client.getChainId() === '0x89') return;
  await client.switchChain({
    chainId: '0x89',
    chainConfiguration: {
      chainId: '0x89', chainName: 'Polygon Mainnet',
      nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
      rpcUrls: [DEFAULT_RPC_URL], blockExplorerUrls: ['https://polygonscan.com'],
    },
  });
}

export async function connectWallet() {
  // Let MetaMask Connect detect the platform and choose:
  // desktop extension -> direct transport
  // mobile native browser -> MetaMask Mobile deeplink + relay
  const client = await getMetaMaskClient();
  const result = await client.connect({ chainIds: ['0x89', '0x1'] });
  if (client.getChainId() !== '0x89') {
    await client.switchChain({
      chainId: '0x89',
      chainConfiguration: {
        chainId: '0x89', chainName: 'Polygon Mainnet',
        nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
        rpcUrls: [DEFAULT_RPC_URL], blockExplorerUrls: ['https://polygonscan.com'],
      },
    });
  }
  const address = result.accounts?.[0] ?? client.getAccount();
  if (!address || !isAddress(address)) throw new Error('No wallet account was selected.');
  return address as Address;
}

export async function getCurrentWallet() {
  if (typeof window === 'undefined') return null;
  try {
    const client = await getMetaMaskClient();
    if (client.status !== 'connected') return null;
    const address = client.getAccount();
    return address && isAddress(address) ? address as Address : null;
  } catch { return null; }
}

export async function readCrxWallet(address: Address) {
  const decimals = Number(await readContract({ address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'decimals' }));
  const balanceRaw = await readContract({ address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'balanceOf', args: [address] });
  const allowanceRaw = CRX_CONTEST_POOL_ADDRESS ? await readContract({ address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'allowance', args: [address, CRX_CONTEST_POOL_ADDRESS] }) : 0n;
  return { address, decimals, balanceRaw, allowanceRaw, balance: Number(formatUnits(balanceRaw, decimals)), allowance: Number(formatUnits(allowanceRaw, decimals)) };
}

export async function approveContestPool(amount: string | number, decimals = 18) {
  if (!CRX_CONTEST_POOL_ADDRESS) throw new Error('CRX contest pool address is not configured.');
  const ethereum = await getEthereumProvider(true);
  const walletClient = createWalletClient({ chain: polygon, transport: custom(ethereum as any) });
  const [account] = await walletClient.requestAddresses();
  const hash = await walletClient.writeContract({ account, chain: polygon, address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'approve', args: [CRX_CONTEST_POOL_ADDRESS, parseUnits(String(amount), decimals)] });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function joinOnchainContest(contestId: number) {
  if (!CRX_CONTEST_POOL_ADDRESS) throw new Error('CRX contest pool address is not configured.');
  const ethereum = await getEthereumProvider(true);
  const walletClient = createWalletClient({ chain: polygon, transport: custom(ethereum as any) });
  const [account] = await walletClient.requestAddresses();
  const hash = await walletClient.writeContract({ account, chain: polygon, address: CRX_CONTEST_POOL_ADDRESS, abi: POOL_ABI, functionName: 'joinContest', args: [BigInt(contestId)] });
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, account };
}

export async function sendCrx(to: string, amount: string, decimals = 18) {
  if (!isAddress(to)) throw new Error('Enter a valid wallet address.');
  const ethereum = await getEthereumProvider(true);
  const walletClient = createWalletClient({ chain: polygon, transport: custom(ethereum as any) });
  const [account] = await walletClient.requestAddresses();
  const hash = await walletClient.writeContract({ account, chain: polygon, address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'transfer', args: [to as Address, parseUnits(amount, decimals)] });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function readOnchainContest(contestId: number) {
  if (!CRX_CONTEST_POOL_ADDRESS) throw new Error('CRX contest pool address is not configured.');
  const [entryFeeRaw, stage, participantCount] = await Promise.all([
    readContract({ address: CRX_CONTEST_POOL_ADDRESS, abi: POOL_ABI, functionName: 'entryFee', args: [BigInt(contestId)] }),
    readContract({ address: CRX_CONTEST_POOL_ADDRESS, abi: POOL_ABI, functionName: 'stage', args: [BigInt(contestId)] }),
    readContract({ address: CRX_CONTEST_POOL_ADDRESS, abi: POOL_ABI, functionName: 'participantCount', args: [BigInt(contestId)] }),
  ]);
  const decimals = Number(await readContract({ address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'decimals' }));
  return { entryFee: Number(formatUnits(entryFeeRaw, decimals)), stage: Number(stage), participantCount: Number(participantCount), decimals };
}
