import { useCallback, useMemo, useState } from 'react';
import { createTransactionKit, type TransactionKit } from '@genlayer/transaction-kit';
import {
  GenLayerTransactionPanel,
  describeOutcome,
  type SubmitInput,
  type TrackedStatus,
} from '@genlayer/transaction-kit-react';
import { GENLAYER_CHAIN, GENLAYER_CHAIN_NAME } from './network';
import { connectAccount, getProvider, switchAccount } from './genlayer';

type Pending = {
  tx: SubmitInput;
  userValue: bigint;
  label: string;
  onHash?: (hash: string) => void;
  resolve: (status: TrackedStatus) => void;
  reject: (error: Error) => void;
};

export type GateClient = {
  run: (
    address: `0x${string}`,
    method: string,
    args: unknown[],
    userValue: bigint,
    onHash?: (hash: string) => void,
  ) => Promise<TrackedStatus>;
};

/**
 * Consensus v0.6 signing gate.
 *
 * Studio Next charges fees, so a write can no longer be a bare `writeContract`.
 * `run()` returns a promise that settles only after the user has reviewed the
 * fee quote, signed, and the network has decided the transaction — which lets
 * every existing call site keep its `await write…` shape and its own
 * contract-state postcondition check.
 *
 * The kit is rebuilt whenever the account changes, so a wallet switch can never
 * sign with the previous address' quote.
 */
export function useTxGate() {
  const [account, setAccount] = useState<`0x${string}` | ''>('');
  const [pending, setPending] = useState<Pending | null>(null);

  const kit: TransactionKit | null = useMemo(() => {
    const provider = getProvider();
    if (!provider || !account) return null;
    return createTransactionKit({ chain: GENLAYER_CHAIN, provider, account });
  }, [account]);

  const run = useCallback<GateClient['run']>((address, method, args, userValue, onHash) => {
    return new Promise<TrackedStatus>((resolve, reject) => {
      setPending({
        tx: { kind: 'write', address, method, args },
        userValue: userValue ?? 0n,
        label: method,
        onHash,
        resolve,
        reject,
      });
    });
  }, []);

  const client = useMemo<GateClient>(() => ({ run }), [run]);

  const connect = useCallback(async () => {
    const next = await connectAccount();
    setAccount(next);
    return { account: next, client };
  }, [client]);

  const changeAccount = useCallback(async () => {
    const next = await switchAccount();
    setAccount(next);
    return { account: next, client };
  }, [client]);

  function settleDone(status: TrackedStatus) {
    if (!pending) return;
    if (status.genlayerTxId) pending.onHash?.(status.genlayerTxId);
    if (status.successful === false) {
      const outcome = describeOutcome(status.statusName, status.executionResultName);
      pending.reject(new Error(`${pending.label} did not execute: ${outcome.title}. ${outcome.detail}`));
    } else {
      pending.resolve(status);
    }
    setPending(null);
  }

  function cancel() {
    if (!pending) return;
    pending.reject(new Error('Transaction cancelled before signing. Nothing was submitted.'));
    setPending(null);
  }

  const modal =
    pending && kit ? (
      <div className="txgate-backdrop" role="dialog" aria-modal="true" aria-label={`Review fees for ${pending.label}`}>
        <div className="txgate-sheet">
          <div className="txgate-head">
            <div>
              <span className="txgate-eyebrow">Fees · Consensus v0.6</span>
              <b>{pending.label}</b>
            </div>
            <button type="button" className="txgate-close" onClick={cancel}>
              Cancel
            </button>
          </div>

          <GenLayerTransactionPanel
            kit={kit}
            tx={pending.tx}
            userValue={pending.userValue}
            network={GENLAYER_CHAIN_NAME}
            theme="dark"
            trackUntil="decided"
            onDone={settleDone}
          />

          <p className="txgate-note">
            A decided transaction is not a verdict. CausalBond re-reads contract state before anything is
            reported as done.
          </p>
        </div>
      </div>
    ) : null;

  return { account, client, connect, switchAccount: changeAccount, modal, busy: pending !== null };
}
