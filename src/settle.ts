import { createClient, isSuccessful } from 'genlayer-js';
import type { TrackedStatus } from '@genlayer/transaction-kit-react';
import { GENLAYER_CHAIN } from './network';
import { getProvider } from './genlayer';

/**
 * Money-moving writes — Consensus v0.6 message-allocation path.
 *
 * Five contract methods send native GEN out with `emit_transfer`. Under v0.6 a
 * fee-bearing outgoing message must be covered by a *message allocation tree*
 * that the signer declares up front — not merely by a total budget. Two
 * observed failures, in order, as the declaration got closer:
 *
 *   fee no_matching_allocation # external
 *   Mode1MessageFeesRequireGenVMPerEmissionSupport:
 *       fee-bearing GenVM messages require a message allocation tree
 *
 * Transaction Kit cannot express that tree: its own docs say the panel "never
 * simulates the call live", and its public input carries only a fee
 * distribution. The allocations can only come from a simulation that observes
 * which messages the call actually emits, which is what
 * `estimateTransactionFeesForWrite` does.
 *
 * So these five methods bypass the kit and take this path instead. Every other
 * write still goes through the kit's fee panel.
 */
export const MESSAGE_BEARING_METHODS = new Set([
  'finalize_dispute',
  'settle_no_breach',
  'force_prime_fallback_after_evaluation_timeout',
  'close_after_execution_deadline',
  'cancel_unaccepted_handoff',
]);

export async function writeWithMessageAllocations(
  account: `0x${string}`,
  address: `0x${string}`,
  functionName: string,
  args: unknown[],
  onHash?: (hash: string) => void,
): Promise<TrackedStatus> {
  const provider = getProvider();
  if (!provider) throw new Error('No EIP-1193 wallet detected.');

  /**
   * The two account forms are NOT interchangeable, and each call site wants a
   * different one. genlayer-js decides where to send wallet methods with:
   *
   *     const isAddress = typeof config.account !== "object";
   *     if (PROVIDER_METHODS.has(method) && isAddress) -> provider.request(...)
   *
   * so `createClient` must get the bare ADDRESS STRING; hand it an object and
   * `eth_sendTransaction` is posted to the GenLayer RPC, which does not
   * implement it ("Method not found: eth_sendTransaction").
   *
   * The per-call sender is resolved as `account?.address ?? ...`, so those want
   * an OBJECT; hand them a string and viem rejects `Address "undefined"`.
   *
   * Both failures were observed in that order. Address to the client, object to
   * the calls.
   */
  const sender = { address: account, type: 'json-rpc' as const };

  const client = createClient({ chain: GENLAYER_CHAIN, account, provider: provider as never });

  const estimate = await client.estimateTransactionFeesForWrite({
    account: sender as never,
    address,
    functionName,
    args: args as never[],
  });

  if (!estimate.messageAllocations || estimate.messageAllocations.length === 0) {
    throw new Error(
      `The simulation of ${functionName} reported no outgoing messages, so no allocation tree could be ` +
        'built. Nothing was submitted — signing now would fail the same way at execution.',
    );
  }

  const hash = (await client.writeContract({
    account: sender as never,
    address,
    functionName,
    args: args as never[],
    fees: {
      distribution: estimate.distribution,
      messageAllocations: estimate.messageAllocations,
      feeValue: estimate.feeValue,
    },
  })) as `0x${string}`;

  onHash?.(hash);

  const receipt = await client.waitForTransactionReceipt({ hash: hash as never, waitUntil: 'decided', retries: 200 });
  const ok = isSuccessful(receipt as never);

  return {
    phase: 'decided',
    genlayerTxId: hash,
    statusName: (receipt as { status?: string })?.status,
    successful: ok,
  } as TrackedStatus;
}
