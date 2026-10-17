'use client';

import { zeroAddress, type Address } from 'viem';

const CLOB = 'https://clob.polymarket.com';
const ZERO32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const EXCHANGE_V2 = '0xE111180000d2663C0091e4f400237545B87B996B' as Address;
const NEG_RISK_EXCHANGE_V2 = '0xe2222d279d744050d28e00520010520000310F59' as Address;

export type ClobCredentials = { key: string; secret: string; passphrase: string };
export type TradeSide = 'BUY' | 'SELL';

export type PolymarketGeoblock = {
  blocked: boolean;
  country?: string;
  region?: string;
};

export async function checkPolymarketGeoblock(): Promise<PolymarketGeoblock> {
  const response = await fetch('https://polymarket.com/api/geoblock', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const result = await responseJson(response);
  if (typeof result.blocked !== 'boolean') {
    throw new Error('Polymarket did not return a valid geographic eligibility response. Trading is paused for safety.');
  }
  return {
    blocked: result.blocked,
    country: typeof result.country === 'string' ? result.country : undefined,
    region: typeof result.region === 'string' ? result.region : undefined,
  };
}

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
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_');
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
  const priceScaledNumber = Math.round(args.price * 1_000_000);
  const priceCanonical = priceScaledNumber / 1_000_000;
  const tickScaledNumber = Math.round(Number(tickSize) * 1_000_000);
  const shares = Math.floor(args.shares * 100) / 100;
  if (!Number.isFinite(args.price) || !Number.isSafeInteger(priceScaledNumber) ||
      Math.abs(args.price - priceCanonical) > 8 * Number.EPSILON ||
      priceScaledNumber <= 0 || priceScaledNumber >= 1_000_000) {
    throw new Error('Price must be between 0 and 1 with at most six decimal places.');
  }
  if (!Number.isFinite(shares) || shares < 5) throw new Error('Enter at least 5 shares. Polymarket market minimums may be higher.');
  if (!Number.isSafeInteger(tickScaledNumber) || tickScaledNumber <= 0 ||
      priceScaledNumber < tickScaledNumber || priceScaledNumber > 1_000_000 - tickScaledNumber ||
      priceScaledNumber % tickScaledNumber !== 0) {
    throw new Error('Price must follow this market’s tick size of ' + tickSize + '.');
  }

  // Match Polymarket's six-decimal fixed-point rounding: shares are quantized
  // down to 2 decimals and collateral is rounded down to the tick's amount precision.
  const amountDecimals: Record<string, number> = { '0.1': 3, '0.01': 4, '0.005': 5, '0.0025': 6, '0.001': 5, '0.0001': 6 };
  const amountPrecision = amountDecimals[tickSize];
  if (amountPrecision === undefined) throw new Error('Unsupported market tick size: ' + tickSize + '.');
  const shareUnits = BigInt(Math.round(shares * 1_000_000));
  const priceUnits = BigInt(priceScaledNumber);
  const quantum = 10n ** BigInt(6 - amountPrecision);
  const cashUnits = ((shareUnits * priceUnits) / (1_000_000n * quantum)) * quantum;
  if (cashUnits <= 0n || shareUnits <= 0n) throw new Error('Order size is too small after market precision rules are applied.');
  const makerUnits = side === 'BUY' ? cashUnits : shareUnits;
  const takerUnits = side === 'BUY' ? shareUnits : cashUnits;
  // Use a cryptographically secure random salt, bounded to the JSON-safe integer range.
  const saltWords = crypto.getRandomValues(new Uint32Array(2));
  const salt = ((BigInt(saltWords[0] & 0x1fffff) << 32n) | BigInt(saltWords[1])).toString();
  const order = {
    salt,
    maker: address,
    signer: address,
    taker: zeroAddress,
    tokenId,
    makerAmount: makerUnits.toString(),
    takerAmount: takerUnits.toString(),
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
    message: {
      // Pass EIP-712 uint256 fields as bigint to avoid ambiguous string coercion.
      salt: BigInt(order.salt),
      maker: order.maker,
      signer: order.signer,
      tokenId: BigInt(order.tokenId),
      makerAmount: BigInt(order.makerAmount),
      takerAmount: BigInt(order.takerAmount),
      side: side === 'BUY' ? 0 : 1,
      signatureType: order.signatureType,
      timestamp: BigInt(order.timestamp),
      metadata: order.metadata,
      builder: order.builder,
    },
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

export type MarketTradingInfo = {
  tickSize: string;
  negRisk: boolean;
  minimumOrderSize: number | null;
  feeRate: number | null;
  feesEnabled: boolean;
};

export async function getMarketTradingInfo(tokenId: string, feesEnabled = false): Promise<MarketTradingInfo> {
  const encoded = encodeURIComponent(tokenId);
  const [tickResponse, riskResponse, bookResponse, feeResponse] = await Promise.all([
    fetch(CLOB + '/tick-size?token_id=' + encoded),
    fetch(CLOB + '/neg-risk?token_id=' + encoded),
    fetch(CLOB + '/book?token_id=' + encoded),
    fetch(CLOB + '/fee-rate?token_id=' + encoded),
  ]);
  const [tick, risk, book, fee] = await Promise.all([
    responseJson(tickResponse), responseJson(riskResponse), responseJson(bookResponse), responseJson(feeResponse),
  ]);
  const minimumOrderSize = Number(book.min_order_size);
  const baseFee = Number(fee.base_fee);
  // Polymarket's CLOB fee-rate endpoint expresses base_fee in basis points.
  // Gamma's per-market feesEnabled flag is authoritative for whether fees apply.
  const feeRate = Number.isFinite(baseFee) && baseFee >= 0 ? baseFee / 10_000 : null;
  return {
    tickSize: String(tick.minimum_tick_size ?? book.tick_size ?? '0.01'),
    negRisk: Boolean(risk.neg_risk),
    minimumOrderSize: Number.isFinite(minimumOrderSize) && minimumOrderSize > 0 ? minimumOrderSize : null,
    feeRate,
    feesEnabled: feesEnabled && feeRate !== null && feeRate > 0,
  };
}
