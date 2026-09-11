'use client';

import { createPublicClient, createWalletClient, custom, formatUnits, http, isAddress, parseUnits, type Address, type Hex } from 'viem';
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
  { type: 'function', name: 'hasEntered', stateMutability: 'view', inputs: [{ name: 'contestId', type: 'uint256' }, { type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'joinContest', stateMutability: 'nonpayable', inputs: [{ name: 'contestId', type: 'uint256' }], outputs: [] },
] as const;

const publicClient = createPublicClient({ chain: polygon, transport: http(DEFAULT_RPC_URL) });

declare global {
  interface Window { ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown>; on?: Function; removeListener?: Function } }
}

function requireEthereum() {
  if (typeof window === 'undefined' || !window.ethereum) throw new Error('MetaMask is not installed. Install MetaMask and try again.');
  return window.ethereum;
}

export function shortAddress(address?: string | null) { return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''; }

export async function switchToPolygon() {
  const ethereum = requireEthereum();
  const chainId = await ethereum.request({ method: 'eth_chainId' }) as string;
  if (Number.parseInt(chainId, 16) === POLYGON_CHAIN_ID) return;
  try {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] });
  } catch (err: any) {
    if (err?.code !== 4902) throw err;
    await ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x89', chainName: 'Polygon Mainnet', nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 }, rpcUrls: [DEFAULT_RPC_URL], blockExplorerUrls: ['https://polygonscan.com'] }] });
  }
}

export async function connectWallet() {
  const ethereum = requireEthereum();
  await switchToPolygon();
  const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[];
  const address = accounts?.[0];
  if (!address || !isAddress(address)) throw new Error('No wallet account was selected.');
  return address as Address;
}

export async function getCurrentWallet() {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
  const address = accounts?.[0];
  return address && isAddress(address) ? address as Address : null;
}

export async function readCrxWallet(address: Address) {
  const decimals = Number(await publicClient.readContract({ address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'decimals' }));
  const balanceRaw = await publicClient.readContract({ address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'balanceOf', args: [address] });
  const allowanceRaw = CRX_CONTEST_POOL_ADDRESS
    ? await publicClient.readContract({ address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'allowance', args: [address, CRX_CONTEST_POOL_ADDRESS] })
    : 0n;
  return { address, decimals, balanceRaw, allowanceRaw, balance: Number(formatUnits(balanceRaw, decimals)), allowance: Number(formatUnits(allowanceRaw, decimals)) };
}

export async function approveContestPool(amount: string | number, decimals = 18) {
  if (!CRX_CONTEST_POOL_ADDRESS) throw new Error('CRX contest pool address is not configured.');
  const ethereum = requireEthereum();
  const walletClient = createWalletClient({ chain: polygon, transport: custom(ethereum as any) });
  const [account] = await walletClient.requestAddresses();
  const hash = await walletClient.writeContract({ account, address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'approve', args: [CRX_CONTEST_POOL_ADDRESS, parseUnits(String(amount), decimals)] });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function joinOnchainContest(contestId: number) {
  if (!CRX_CONTEST_POOL_ADDRESS) throw new Error('CRX contest pool address is not configured.');
  const ethereum = requireEthereum();
  const walletClient = createWalletClient({ chain: polygon, transport: custom(ethereum as any) });
  const [account] = await walletClient.requestAddresses();
  const hash = await walletClient.writeContract({ account, address: CRX_CONTEST_POOL_ADDRESS, abi: POOL_ABI, functionName: 'joinContest', args: [BigInt(contestId)] });
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, account };
}

export async function sendCrx(to: string, amount: string, decimals = 18) {
  if (!isAddress(to)) throw new Error('Enter a valid wallet address.');
  const ethereum = requireEthereum();
  const walletClient = createWalletClient({ chain: polygon, transport: custom(ethereum as any) });
  const [account] = await walletClient.requestAddresses();
  const value = parseUnits(amount, decimals);
  const hash = await walletClient.writeContract({ account, address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'transfer', args: [to as Address, value] });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function readOnchainContest(contestId: number) {
  if (!CRX_CONTEST_POOL_ADDRESS) throw new Error('CRX contest pool address is not configured.');
  const [entryFeeRaw, stage, participantCount] = await Promise.all([
    publicClient.readContract({ address: CRX_CONTEST_POOL_ADDRESS, abi: POOL_ABI, functionName: 'entryFee', args: [BigInt(contestId)] }),
    publicClient.readContract({ address: CRX_CONTEST_POOL_ADDRESS, abi: POOL_ABI, functionName: 'stage', args: [BigInt(contestId)] }),
    publicClient.readContract({ address: CRX_CONTEST_POOL_ADDRESS, abi: POOL_ABI, functionName: 'participantCount', args: [BigInt(contestId)] }),
  ]);
  const decimals = Number(await publicClient.readContract({ address: CRX_TOKEN_ADDRESS, abi: CRX_ABI, functionName: 'decimals' }));
  return { entryFee: Number(formatUnits(entryFeeRaw, decimals)), stage: Number(stage), participantCount: Number(participantCount), decimals };
}
