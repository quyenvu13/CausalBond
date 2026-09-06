import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionHashVariant, TransactionStatus } from 'genlayer-js/types';

export const readClient = createClient({ chain: studionet });

export async function connectWallet() {
  if (!window.ethereum) throw new Error('No EIP-1193 wallet detected.');
  const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts?.[0]) throw new Error('Wallet returned no account.');
  const account = accounts[0] as `0x${string}`;
  const client = createClient({ chain: studionet, account, provider: window.ethereum as any });
  try {
    await client.connect('studionet');
  } catch (error: any) {
    throw new Error(`Could not confirm StudioNet connection. Underlying: ${error?.message ?? String(error)}`);
  }
  return { account, client };
}

export async function readJson<T>(address: `0x${string}`, functionName: string, args: unknown[]) {
  const raw = await readClient.readContract({ address, functionName, args: args as any[], transactionHashVariant: TransactionHashVariant.LATEST_FINAL });
  if (typeof raw !== 'string' || raw === '') return null;
  return JSON.parse(raw) as T;
}

export async function writeAndFinalize(
  client: any,
  address: `0x${string}`,
  functionName: string,
  args: unknown[],
  value: bigint = 0n,
  onHash?: (hash: string) => void,
) {
  const submitted = await client.writeContract({ address, functionName, args: args as any[], value });
  if (typeof submitted !== 'string' || !submitted) throw new Error('writeContract returned no transaction id.');
  onHash?.(submitted);
  const receipt = await client.waitForTransactionReceipt({ hash: submitted, status: TransactionStatus.FINALIZED, interval: 4000, retries: 40 });
  const execution = receipt?.txExecutionResultName ?? null;
  if (execution && execution !== 'FINISHED_WITH_RETURN') {
    throw new Error(`Contract execution failed or did not return successfully: ${execution}`);
  }
  // StudioNet may omit txExecutionResultName on finalized transactions. Finalization
  // alone is not treated as success: every caller must verify a contract-state
  // postcondition before displaying a success message.
  return { hash: submitted, receipt, executionVerified: execution === 'FINISHED_WITH_RETURN' };
}

export async function readString(address: `0x${string}`, functionName: string, args: unknown[]) {
  const raw = await readClient.readContract({ address, functionName, args: args as any[], transactionHashVariant: TransactionHashVariant.LATEST_FINAL });
  return String(raw ?? '');
}
