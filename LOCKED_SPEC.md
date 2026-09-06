# CausalBond — locked specification

## Product invariant

CausalBond routes bonded responsibility across a recorded AI-agent delegation chain without asking validators to localize the responsible agent.

## Immutable design rules for this build

1. Every semantic comparison is against the **ORIGINAL M0 clause**, never an adjacent mandate.
2. M0 contains **2–4 separate machine-checkable clauses**, not a single free-form specification.
3. The semantic wire space is exactly `CARRIES` / `DOES_NOT_CARRY`.
4. One semantic call covers exactly one breached original clause and one accepted handoff mandate.
5. Child acceptance is mandatory before a handoff becomes active.
6. The structured receipt, not a user claim or validator, determines which original clauses were breached.
7. The receipt authority must be independent of the principal, prime, and all chain agents.
8. The contract derives responsibility from the boolean matrix deterministically.
9. A temporary loss that is restored before execution does not make the earlier edge responsible.
10. If no accepted edge is responsible for a **real receipt-confirmed breach**, the prime agent is liable.
11. Bonds are sized per clause so multiple independently breached clauses can produce multiple deterministic slashes.
12. A recorded-but-unaccepted final handoff cannot block receipt submission and never enters semantic evaluation.
13. No authenticated receipt means no deterministic breach predicate; no-receipt timeout returns locked bonds rather than manufacturing liability from silence.
14. No cancellation, timeout, or settlement path may bypass an already-created receipt-confirmed economic consequence.
15. All protocol time comes from the transaction datetime, not validator-local wall clocks.
16. External-world execution is outside the contract's claim.

## Supported clause kinds

- `REFUNDABLE_REQUIRED`
- `MAX_TOTAL_PRICE_USD`
- `MIN_CANCELLATION_HOURS`
- `LATEST_CHECKIN_UNIX`

## Chain bounds

- Maximum handoffs recorded: 3
- Prime bond: `bond_per_clause_wei × clause_count`
- Edge 1 liability uses the prime bond.
- Each later parent locks the same full required bond before proposing its child.
- A designated child must accept before the handoff becomes part of the signed chain.
- Agent reuse within the recorded chain is rejected.
- The receipt authority cannot be used as a child/chain participant.

## Structured receipt

Exact schema:

```json
{
  "refundable": false,
  "total_price_usd": 350,
  "cancellation_hours": 0,
  "checkin_unix": 1788134400
}
```

Only the independent receipt authority may submit it. The contract authenticates the submitter and computes breach predicates from those fields; it does not attest external truth.

If the last recorded edge is still unsigned, the authority may still submit the receipt. The unsigned edge is excluded from the boolean matrix and its separately posted bond is released by the eventual settlement/refund path.

## Responsibility scan

For each breached clause, build the ordered vector of `CARRIES` booleans over accepted edges. The helper returns the first position whose `false` value stays false through the accepted suffix; finalization maps that position back to the stored `edge_index`. If no such accepted edge exists, responsibility is `PRIME_LIABLE`.

This prevents adjacent-comparison drift, handles restoration correctly, and remains safe if future state shapes ever include an unsigned edge beside an accepted prefix.

## Timeout policy

- **No receipt by execution deadline:** no breach has been authenticated, so the case becomes `TIMED_OUT_NO_RECEIPT` and all locked bonds are returned.
- **Receipt exists but semantic evaluation stalls:** breached clauses are already deterministic facts, so after the evaluation deadline those breached clauses fall back to prime liability and other locked bonds are refunded.
