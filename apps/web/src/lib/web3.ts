'use client';

import { createPublicClient, createWalletClient, custom, formatUnits, http, isAddress, parseUnits, type Address } from 'viem';
import { getAccount, getWalletClient, reconnect, switchChain } from '@wagmi/core';
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
  providers?: EthereumProvider[];
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isBraveWallet?: boolean;
  isTrust?: boolean;
  isPhantom?: boolean;
};

type Eip6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

type Eip6963ProviderDetail = {
  info: Eip6963ProviderInfo;
  provider: EthereumProvider;
};

type Eip6963Wallet = Eip6963ProviderInfo & {
  provider: EthereumProvider;
};

export type DetectedBrowserWallet = Omit<Eip6963Wallet, 'provider'>;

const announcedWallets = new Map<string, Eip6963Wallet>();
let legacyDiscoveryStarted = false;
let activeInjectedWallet: Eip6963Wallet | null = null;

const BROWSER_WALLET_PICKER_EVENT = 'crickx:open-browser-wallet-picker';
let pendingBrowserWalletSelection:
  | {
      resolve: (address: Address) => void;
      reject: (error: Error) => void;
    }
  | null = null;

type TokenPocketWindow = Window & {
  tokenpocket?: {
    ethereum?: EthereumProvider;
  };
};

function isProviderLike(value: unknown): value is EthereumProvider {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as { request?: unknown }).request === 'function',
  );
}

function walletNameFromKey(key: string) {
  const cleaned = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  if (!cleaned) return 'Browser Wallet';
  return cleaned
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function addUnknownInjectedProvider(provider: EthereumProvider, source: string, index: number) {
  const existing = [...announcedWallets.values()].find(item => item.provider === provider);
  if (existing) return;

  const name = walletNameFromKey(source);
  const rdns = `legacy.injected.${source.toLowerCase().replace(/[^a-z0-9]+/g, '.')}`;
  addNamedInjectedProvider(provider, name, `${rdns}.${index}`);
}

function addNamedInjectedProvider(provider: EthereumProvider, name: string, rdns: string, icon = '') {
  const existing = [...announcedWallets.values()].find(item => item.provider === provider);
  if (existing) return existing.uuid;

  const uuid = `legacy:${rdns}`;
  announcedWallets.set(uuid, {
    uuid,
    name,
    icon,
    rdns,
    provider,
  });
  return uuid;
}

function addLegacyProvider(provider: EthereumProvider, index = 0) {
  const existing = [...announcedWallets.values()].find(item => item.provider === provider);
  if (existing) return;

  const name =
    provider.isMetaMask ? 'MetaMask' :
    provider.isCoinbaseWallet ? 'Coinbase Wallet' :
    provider.isRabby ? 'Rabby' :
    provider.isBraveWallet ? 'Brave Wallet' :
    provider.isTrust ? 'Trust Wallet' :
    provider.isPhantom ? 'Phantom' :
    index > 0 ? `Injected Wallet ${index + 1}` :
    'Browser Wallet';

  const rdns = provider.isMetaMask ? 'io.metamask' : name.toLowerCase().replace(/[^a-z0-9]+/g, '.');
  announcedWallets.set(`legacy:${rdns}:${index}`, {
    uuid: `legacy:${rdns}:${index}`,
    name,
    icon: '',
    rdns,
    provider,
  });
}

function refreshLegacyInjectedProviders() {
  if (typeof window === 'undefined') return;

  const ethereum = (window as typeof window & { ethereum?: EthereumProvider }).ethereum;
  if (ethereum?.providers?.length) {
    ethereum.providers.forEach((provider, index) => addLegacyProvider(provider, index));
  } else if (ethereum) {
    addLegacyProvider(ethereum);
  }

  // TokenPocket explicitly exposes its EVM provider as window.tokenpocket.ethereum.
  const tokenPocketProvider = (window as TokenPocketWindow).tokenpocket?.ethereum;
  if (tokenPocketProvider) {
    addNamedInjectedProvider(tokenPocketProvider, 'TokenPocket', 'io.tokenpocket', '');
  }

  // Some wallets still expose an EIP-1193 provider on a wallet-specific
  // window property even when their EIP-6963 announcement is unavailable.
  // Discover those providers generically so the app does not depend on a
  // hard-coded wallet allowlist.
  const windowObject = window as unknown as Record<string, unknown>;
  const candidateKeys = Object.getOwnPropertyNames(windowObject);

  for (const key of candidateKeys) {
    if (key === 'window' || key === 'self' || key === 'globalThis' || key === 'frames' || key === 'parent' || key === 'top') {
      continue;
    }

    let value: unknown;
    try {
      value = windowObject[key];
    } catch {
      continue;
    }

    if (isProviderLike(value)) {
      addUnknownInjectedProvider(value, key, 0);
      continue;
    }

    if (!value || (typeof value !== 'object' && typeof value !== 'function')) continue;

    const nested = value as Record<string, unknown>;
    for (const nestedKey of ['ethereum', 'provider', 'evm', 'eth', 'wallet']) {
      let nestedValue: unknown;
      try {
        nestedValue = nested[nestedKey];
      } catch {
        continue;
      }
      if (isProviderLike(nestedValue)) {
        addUnknownInjectedProvider(nestedValue, key + '.' + nestedKey, 0);
      }
    }
  }
}

function startBrowserWalletDiscovery() {
  if (typeof window === 'undefined' || legacyDiscoveryStarted) {
    refreshLegacyInjectedProviders();
    return;
  }
  legacyDiscoveryStarted = true;

  const handleAnnouncement = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
    if (!detail?.info?.uuid || !detail?.provider) return;
    const info = detail.info;
    announcedWallets.set(info.uuid, {
      uuid: info.uuid,
      name: info.name || 'Browser Wallet',
      icon: info.icon || '',
      rdns: info.rdns || info.name || info.uuid,
      provider: detail.provider,
    });
  };

  window.addEventListener('eip6963:announceProvider', handleAnnouncement);
  refreshLegacyInjectedProviders();
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

export async function getDetectedBrowserWallets(): Promise<DetectedBrowserWallet[]> {
  if (typeof window === 'undefined') return [];
  startBrowserWalletDiscovery();
  refreshLegacyInjectedProviders();

  window.dispatchEvent(new Event('eip6963:requestProvider'));

  // Wallet extensions can announce asynchronously. Collect announcements
  // for a short, bounded window so late-loading extensions are not missed.
  await new Promise(resolve => setTimeout(resolve, 1000));

  const wallets = [...announcedWallets.values()];
  const unique = new Map<string, Eip6963Wallet>();

  for (const wallet of wallets) {
    const dedupeKey = wallet.rdns || wallet.name.toLowerCase();
    if (!unique.has(dedupeKey) || !wallet.uuid.startsWith('legacy:')) {
      unique.set(dedupeKey, wallet);
    }
  }

  return [...unique.values()].map(({ provider: _provider, ...wallet }) => wallet);
}

async function getDetectedWalletProvider(uuid: string) {
  startBrowserWalletDiscovery();
  refreshLegacyInjectedProviders();
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  await new Promise(resolve => setTimeout(resolve, 75));
  return announcedWallets.get(uuid)?.provider ?? null;
}

async function switchProviderToPolygon(provider: EthereumProvider) {
  const chainId = await provider.request({ method: 'eth_chainId' });
  const numericChainId = typeof chainId === 'number'
    ? chainId
    : Number.parseInt(String(chainId), 16);
  if (numericChainId === POLYGON_CHAIN_ID) return;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x89' }],
    });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error
      ? (error as { code?: number }).code
      : undefined;

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

export function browserWalletPickerEventName() {
  return BROWSER_WALLET_PICKER_EVENT;
}

export function requestBrowserWalletSelection(wallets: DetectedBrowserWallet[]): Promise<Address> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Wallet connection is only available in the browser.'));
  }

  if (pendingBrowserWalletSelection) {
    pendingBrowserWalletSelection.reject(new Error('Previous wallet selection was replaced.'));
  }

  return new Promise<Address>((resolve, reject) => {
    pendingBrowserWalletSelection = { resolve, reject };
    window.dispatchEvent(new CustomEvent(BROWSER_WALLET_PICKER_EVENT, {
      detail: { wallets },
    }));
  });
}

export async function selectBrowserWalletFromPicker(uuid: string) {
  const pending = pendingBrowserWalletSelection;
  if (!pending) return;

  try {
    const address = await connectDetectedBrowserWallet(uuid);
    pendingBrowserWalletSelection = null;
    pending.resolve(address);
  } catch (error) {
    pendingBrowserWalletSelection = null;
    pending.reject(normalizeWalletError(error, 'Unable to connect the selected browser wallet.'));
  }
}

export function cancelBrowserWalletPicker() {
  const pending = pendingBrowserWalletSelection;
  pendingBrowserWalletSelection = null;
  pending?.reject(new Error('Wallet selection cancelled.'));
}

export function resolveBrowserWalletPicker(address: Address) {
  const pending = pendingBrowserWalletSelection;
  pendingBrowserWalletSelection = null;
  pending?.resolve(address);
}

export function rejectBrowserWalletPicker(error: unknown) {
  const pending = pendingBrowserWalletSelection;
  pendingBrowserWalletSelection = null;
  pending?.reject(normalizeWalletError(error, 'Wallet connection could not be completed.'));
}

export async function connectDetectedBrowserWallet(uuid: string): Promise<Address> {
  const provider = await getDetectedWalletProvider(uuid);
  if (!provider) throw new Error('That browser wallet is no longer available. Refresh the page and try again.');

  try {
    await provider.request({ method: 'eth_requestAccounts' });
    await switchProviderToPolygon(provider);
    const accounts = await provider.request({ method: 'eth_accounts' });
    const address = Array.isArray(accounts) ? accounts[0] : undefined;
    if (typeof address !== 'string' || !isAddress(address)) {
      throw new Error('The selected wallet did not return a valid account.');
    }

    const wallet = announcedWallets.get(uuid);
    if (!wallet) throw new Error('The selected wallet could not be identified.');

    activeInjectedWallet = wallet;
    try { window.localStorage.setItem('crickx.wallet.rdns', wallet.rdns); } catch { /* storage may be unavailable */ }

    if (appKit) {
      try { await appKit.disconnect(); } catch { /* keep direct wallet connection */ }
    }

    return address as Address;
  } catch (error) {
    throw normalizeWalletError(error, 'Unable to connect the selected browser wallet.');
  }
}



function normalizeWalletError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/broadcast channel unavailable/i.test(message)) {
    return new Error('Your wallet extension could not open its connection channel. Refresh this page and reconnect, or choose another wallet from the wallet picker.');
  }
  return error instanceof Error ? error : new Error(fallback);
}

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
  if (connect) {
    try {
      await provider.request({ method: 'eth_requestAccounts' });
    } catch (error) {
      throw normalizeWalletError(error, 'Unable to connect the selected wallet.');
    }
  }
  return provider;
}

function getWagmiConfig() {
  if (!MULTI_WALLET_ENABLED || !wagmiAdapter) return null;
  return wagmiAdapter.wagmiConfig;
}

let restoreConnectionPromise: Promise<Address | null> | null = null;

async function restoreDirectInjectedWallet(): Promise<Address | null> {
  if (typeof window === 'undefined') return null;

  startBrowserWalletDiscovery();

  let storedRdns = '';
  try {
    storedRdns = window.localStorage.getItem('crickx.wallet.rdns') || '';
  } catch {
    storedRdns = '';
  }

  if (!storedRdns) return null;

  try {
    const deadline = Date.now() + 1500;
    let restored: Eip6963Wallet | undefined;
    while (Date.now() < deadline) {
      refreshLegacyInjectedProviders();
      window.dispatchEvent(new Event('eip6963:requestProvider'));
      restored = [...announcedWallets.values()].find(wallet => wallet.rdns === storedRdns);
      if (restored) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!restored) return null;

    const accounts = await restored.provider.request({ method: 'eth_accounts' });
    const address = Array.isArray(accounts) ? accounts[0] : undefined;
    if (typeof address !== 'string' || !isAddress(address)) return null;

    activeInjectedWallet = restored;
    return address as Address;
  } catch {
    return null;
  }
}

export async function restorePersistedWalletConnection(): Promise<Address | null> {
  if (typeof window === 'undefined') return null;
  if (restoreConnectionPromise) return restoreConnectionPromise;

  restoreConnectionPromise = (async () => {
    const config = getWagmiConfig();
    if (!config || !wagmiAdapter) return null;

    try {
      const adapter = wagmiAdapter as unknown as { syncConnections?: () => Promise<void> };
      await adapter.syncConnections?.();
    } catch {
      try {
        await reconnect(config);
      } catch {
        // A missing/unavailable wallet should not prevent the app from loading.
      }
    }

    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const account = getAccount(config);
      if (account.isConnected && account.address && isAddress(account.address)) {
        return account.address as Address;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
  })();

  try {
    return await restoreConnectionPromise;
  } finally {
    restoreConnectionPromise = null;
  }
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
  if (!config) throw new Error('Reown AppKit is not configured. Set NEXT_PUBLIC_REOWN_PROJECT_ID in the CrickX web build environment.');

  const account = getAccount(config);
  if (!account.isConnected || !account.address) throw new Error('Connect a wallet first.');

  if (account.chainId !== POLYGON_CHAIN_ID) await switchToPolygon();

  const walletClient = await getWalletClient(config);
  if (!walletClient?.account) throw new Error('The connected wallet is unavailable. Please reconnect your wallet.');
  return walletClient;
}

export function shortAddress(address?: string | null) { return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''; }

export async function switchToPolygon() {
  const config = getWagmiConfig();
  if (!config) throw new Error('Reown AppKit is not configured. Set NEXT_PUBLIC_REOWN_PROJECT_ID in the CrickX web build environment.');

  const account = getAccount(config);
  if (!account.isConnected || !account.address) throw new Error('Connect a wallet first.');
  if (account.chainId === POLYGON_CHAIN_ID) return;
  await switchChain(config, { chainId: POLYGON_CHAIN_ID });
}

export async function openWalletDirectory() {
  return openWalletPicker();
}

async function openWalletPicker() {
  const config = getWagmiConfig();
  if (!config || !appKit || !wagmiAdapter) {
    throw new Error('Reown AppKit is not configured. Set NEXT_PUBLIC_REOWN_PROJECT_ID in the CrickX web build environment.');
  }

  try {
    const adapter = wagmiAdapter as unknown as { syncConnectors?: () => Promise<void> };
    await adapter.syncConnectors?.();
  } catch {
    // Reown will continue with the connectors already available.
  }

  await new Promise(resolve => setTimeout(resolve, 150));

  try {
    await appKit.open({ view: 'Connect' });
  } catch (error) {
    throw normalizeWalletError(error, 'Unable to open the Reown wallet picker.');
  }

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const account = getAccount(config);
    if (account.isConnected && account.address) {
      if (account.chainId !== POLYGON_CHAIN_ID) {
        await switchToPolygon();
      }
      return account.address as Address;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error('Wallet connection was not completed. Please choose a wallet from the Reown wallet window.');
}

export async function changeWallet(_currentAddress?: Address) {
  activeInjectedWallet = null;
  try { window.localStorage.removeItem('crickx.wallet.rdns'); } catch { /* storage may be unavailable */ }

  const config = getWagmiConfig();
  if (config && appKit) {
    try {
      await appKit.disconnect();
    } catch (error) {
      throw normalizeWalletError(error, 'Unable to disconnect the current wallet.');
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return connectWallet();
}

export async function connectWallet() {
  activeInjectedWallet = null;
  return openWalletPicker();
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

  const restored = await restorePersistedWalletConnection();
  if (restored) return restored;

  const config = getWagmiConfig();
  if (!config) return null;

  try {
    const account = getAccount(config);
    return account.isConnected && account.address && isAddress(account.address)
      ? account.address as Address
      : null;
  } catch {
    return null;
  }
}

export async function getConnectedWalletName() {
  const config = getWagmiConfig();
  if (!config) return 'Wallet';

  try {
    const account = getAccount(config);
    return account.connector?.name || 'Wallet';
  } catch {
    return 'Wallet';
  }
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
