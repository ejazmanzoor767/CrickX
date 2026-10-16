'use client';

import { parseUnits, zeroAddress, type Address } from 'viem';

const CLOB = 'https://clob.polymarket.com';
const ZERO32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const EXCHANGE_V2 = '0xE111180000d2663C0091e4f400237545B87B996B' as Address;
const NEG_RISK_EXCHANGE_V2 = '0xe2222d279d744050d28e00520010520000310F59' as Address;

export type ClobCredentials = { key: string; secret: string; passphrase: string };
export type TradeSide = 'BUY' | 'SELL';

type Signer = {
  account?: { address: Address } | Address;
  signTypedData(args: any): Promise<`0x${string}`>;
};

async function responseJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : 'Polymarket returned HTTP ' + response.status + '.';
    throw new Error(message);
  }
  return data;
}

function signerAddress(signer: Signer): Address {
  const account = signer.account;
  const address = typeof account === 'string' ? account : account?.address;
  if (!address) throw new Error('Your connected wallet did not provide an account address.');
  return address;
}

export async function getClobCredentials(signer: Signer): Promise<ClobCredentials> {
  const address = signerAddress(signer);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signer.signTypedData({
    account: address,
    domain: { name: 'ClobAuthDomain', version: '1', chainId: 137 },
    types: { ClobAuth: [
      { name: 'address', type: 'address' },
      { name: 'timestamp', type: 'string' },
      { name: 'nonce', type: 'uint256' },
      { name: 'message', type: 'string' },
    ] },
    primaryType: 'ClobAuth',
    message: { address, timestamp, nonce: 0n, message: 'This message attests that I control the given wallet' },
  });
  const headers = {
    POLY_ADDRESS: address,
    POLY_SIGNATURE: signature,
    POLY_TIMESTAMP: timestamp,
    POLY_NONCE: '0',
    Accept: 'application/json',
  };
  let result: any;
  try {
    const create = await fetch(CLOB + '/auth/api-key', { method: 'POST', headers });
    if (create.ok) result = await create.json();
  } catch { /* try deriving existing credentials below */ }
  if (!result || !(result.apiKey || result.key)) {
    const derived = await fetch(CLOB + '/auth/derive-api-key', { method: 'GET', headers });
    result = await responseJson(derived);
  }
  const creds = {
    key: String(result.apiKey ?? result.key ?? ''),
    secret: String(result.secret ?? ''),
    passphrase: String(result.passphrase ?? ''),
  };
  if (!creds.key || !creds.secret || !creds.passphrase) {
    throw new Error('Polymarket did not return complete API credentials for this wallet.');
  }
  return creds;
}

function decodeBase64Secret(secret: string) {
  const normalized = secret.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSignature(secret: string, timestamp: string, method: string, path: string, body?: string) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure browser cryptography is unavailable. Open CrickX over HTTPS and retry.');
  const key = await crypto.subtle.importKey('raw', decodeBase64Secret(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const message = timestamp + method.toUpperCase() + path + (body ?? '');
  const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
  let binary = '';
  signed.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_');
}

async function clobRequest(path: string, method: string, address: Address, creds: ClobCredentials, body?: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await hmacSignature(creds.secret, timestamp, method, path, body);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    POLY_ADDRESS: address,
    POLY_SIGNATURE: signature,
    POLY_TIMESTAMP: timestamp,
    POLY_API_KEY: creds.key,
    POLY_PASSPHRASE: creds.passphrase,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return responseJson(await fetch(CLOB + path, { method, headers, body }));
}

export async function submitLimitOrder(args: {
  signer: Signer;
  creds: ClobCredentials;
  tokenId: string;
  price: number;
  shares: number;
  side: TradeSide;
  negRisk?: boolean;
  tickSize: string;
}) {
  const { signer, creds, tokenId, side, tickSize } = args;
  const address = signerAddress(signer);
  const priceDecimals = Math.max(0, (tickSize.split('.')[1] ?? '').length);
  const normalizedPrice = Number(args.price.toFixed(priceDecimals));
  const shares = Math.floor(args.shares * 100) / 100;
  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0 || normalizedPrice >= 1) throw new Error('Price must be greater than 0 and less than 1.');
  if (!Number.isFinite(shares) || shares < 5) throw new Error('Enter at least 5 shares. Polymarket market minimums may be higher.');
  if (Math.abs(normalizedPrice / Number(tickSize) - Math.round(normalizedPrice / Number(tickSize))) > 1e-7) {
    throw new Error('Price must follow this market’s tick size of ' + tickSize + '.');
  }

  // Polymarket CLOB V2 order amounts use six-decimal collateral/share units.
  const makerHuman = side === 'BUY' ? Number((shares * normalizedPrice).toFixed(4)) : shares;
  const takerHuman = side === 'BUY' ? shares : Number((shares * normalizedPrice).toFixed(4));
  const order = {
    salt: String(Math.round(Math.random() * Date.now())),
    maker: address,
    signer: address,
    taker: zeroAddress,
    tokenId,
    makerAmount: parseUnits(makerHuman.toFixed(6), 6).toString(),
    takerAmount: parseUnits(takerHuman.toFixed(6), 6).toString(),
    side,
    signatureType: 0,
    timestamp: String(Date.now()),
    expiration: '0',
    metadata: ZERO32,
    builder: ZERO32,
  };
  const domain = {
    name: 'Polymarket CTF Exchange',
    version: '2',
    chainId: 137,
    verifyingContract: (args.negRisk ? NEG_RISK_EXCHANGE_V2 : EXCHANGE_V2),
  } as const;
  const types = {
    Order: [
      { name: 'salt', type: 'uint256' },
      { name: 'maker', type: 'address' },
      { name: 'signer', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'makerAmount', type: 'uint256' },
      { name: 'takerAmount', type: 'uint256' },
      { name: 'side', type: 'uint8' },
      { name: 'signatureType', type: 'uint8' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'metadata', type: 'bytes32' },
      { name: 'builder', type: 'bytes32' },
    ],
  };
  const signature = await signer.signTypedData({
    account: address,
    domain,
    types,
    primaryType: 'Order',
    message: { ...order, side: side === 'BUY' ? 0 : 1 },
  });
  const payload = JSON.stringify({
    deferExec: false,
    postOnly: false,
    order: { ...order, salt: Number(order.salt), signature },
    owner: creds.key,
    orderType: 'GTC',
  });
  return clobRequest('/order', 'POST', address, creds, payload);
}

export async function getMarketTradingInfo(tokenId: string) {
  const [tickResponse, riskResponse] = await Promise.all([
    fetch(CLOB + '/tick-size?token_id=' + encodeURIComponent(tokenId)),
    fetch(CLOB + '/neg-risk?token_id=' + encodeURIComponent(tokenId)),
  ]);
  const [tick, risk] = await Promise.all([responseJson(tickResponse), responseJson(riskResponse)]);
  return { tickSize: String(tick.minimum_tick_size ?? '0.01'), negRisk: Boolean(risk.neg_risk) };
}
