import { studioDevnet } from 'genlayer-js/chains';

/**
 * One network definition, shared by reads (genlayer-js), MetaMask, and
 * Transaction Kit.
 *
 * The published SDK has no Studio Next preset. `studioDevnet` already carries
 * the Consensus v0.6 contract set and chain id 61997, but its RPC points at
 * studio-dev; Studio Next is served from a different host. Overriding the RPC
 * on a copy of that preset keeps the v0.6 wiring and moves only the endpoint.
 *
 * Every consumer reads from the object below, so an RPC override can never
 * produce a transaction signed for a different chain than the one being read.
 */
const DEFAULT_RPC_URL = 'https://studio-next.genlayer.com/api';
const DEFAULT_CHAIN_ID = 61997;
const DEFAULT_CHAIN_NAME = 'GenLayer Studio Next';
const DEFAULT_SYMBOL = 'GEN';
const DEFAULT_EXPLORER_URL = 'https://explorer-studio-next.genlayer.com';

function parseChainId(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_CHAIN_ID;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`VITE_GENLAYER_CHAIN_ID must be a positive integer; received ${raw}`);
  }
  return value;
}

const rpcUrl = import.meta.env.VITE_GENLAYER_RPC_URL || DEFAULT_RPC_URL;
const chainId = parseChainId(import.meta.env.VITE_GENLAYER_CHAIN_ID);
const chainName = import.meta.env.VITE_GENLAYER_CHAIN_NAME || DEFAULT_CHAIN_NAME;
const symbol = import.meta.env.VITE_GENLAYER_SYMBOL || DEFAULT_SYMBOL;

export const EXPLORER_URL = (import.meta.env.VITE_EXPLORER_URL || DEFAULT_EXPLORER_URL).replace(/\/+$/, '');

export const GENLAYER_CHAIN = {
  ...studioDevnet,
  id: chainId,
  name: chainName,
  nativeCurrency: { name: symbol, symbol, decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
} as typeof studioDevnet;

export const GENLAYER_CHAIN_ID = chainId;
export const GENLAYER_CHAIN_NAME = chainName;
export const GENLAYER_CHAIN_ID_HEX = `0x${chainId.toString(16)}` as const;

export const GENLAYER_NETWORK = {
  chainId: GENLAYER_CHAIN_ID_HEX,
  chainName,
  nativeCurrency: { name: symbol, symbol, decimals: 18 },
  rpcUrls: [rpcUrl],
  blockExplorerUrls: [EXPLORER_URL],
};

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}
