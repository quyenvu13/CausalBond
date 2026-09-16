import { GENLAYER_CHAIN_ID } from './network';

/**
 * Developer fee profile — Consensus v0.6 message fees.
 *
 * Five contract methods move native GEN out of the contract via
 * `emit_transfer`. Under v0.6 an outgoing message is paid from a message-fee
 * budget that the SIGNER must declare up front. A transaction submitted with
 * the default distribution declares `totalMessageFees: 0n`, so the node has no
 * budget to match the outgoing external message against and refuses the whole
 * execution:
 *
 *     Execution Result : ERROR
 *     Result Code      : Contract Error
 *     Error Message    : fee no_matching_allocation # external
 *
 * That is not a contract bug — the settlement logic never runs. It is a missing
 * declaration on the client side.
 *
 * The budget below is a CEILING, not a charge: "Unused amounts are refunded
 * when the transaction finalizes." It is sized well above the cost of the
 * transfers each method can emit (finalize_dispute emits at most one
 * compensation plus one refund per bonded edge).
 *
 * The profile is ignored unless `chainId` matches the connected chain exactly,
 * so measurements can never leak across networks.
 */
const MESSAGE_FEE_BUDGET = '10000000000000000'; // 0.01 GEN, refundable

export const CAUSALBOND_FEE_PROFILE = {
  version: 1,
  chainId: GENLAYER_CHAIN_ID,
  network: 'GenLayer Studio Next',
  methods: {
    finalize_dispute: { totalMessageFees: MESSAGE_FEE_BUDGET },
    settle_no_breach: { totalMessageFees: MESSAGE_FEE_BUDGET },
    force_prime_fallback_after_evaluation_timeout: { totalMessageFees: MESSAGE_FEE_BUDGET },
    close_after_execution_deadline: { totalMessageFees: MESSAGE_FEE_BUDGET },
    cancel_unaccepted_handoff: { totalMessageFees: MESSAGE_FEE_BUDGET },
  },
};
