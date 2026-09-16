# Testing

Contract under test: `contracts/CausalBond.py`, sha256
`d8fa13373036e87250bdd51099c8f26c935a4fc02c3d4369087d953dd3fcf83a`
Deployment: `0x12d17759F94d59E662126c683D67de56Ec4F903D` on GenLayer Studio Next
(chain 61997, GenVM v0.3.0-rc7).

Every gate runs against **that exact source file**, never a paraphrase or a second
implementation of the same logic.

## Offline gates

```bash
npm run check
```

| Gate | Command | Result |
|---|---|---|
| AST / policy invariants | `npm run check:ast` | `AST/POLICY: PASS` |
| Contract logic | `npm run check:logic` | `CORE: 27/27 PASS` |
| Adversarial suite | `npm run check:adversarial` | `ADVERSARIAL: 18/18 PASS` |
| Prompt fence probe | `npm run check:fence` | `0/12 bypasses` |
| Mutation matrix | `npm run check:mutations` | `23/23 caught` |
| Frontend build | `tsc -b && vite build` | rc 0 |

The mutation matrix scores each injected defect on three independent gates and
prints which one caught it (`by core` / `by adversarial` / `by ast`). The
unmutated baseline is green on all three, so the score reflects three different
detectors rather than one constant column.

## The v0.3 SDK gate

```bash
bash scripts/setup_v03_sdk.sh /tmp/genvm-v03
SDK=/tmp/genvm-v03/genvm/runners/genlayer-py-std/src
STUB=/tmp/genvm-v03/stub
PYTHONPATH="$STUB:$SDK" python3.13 scripts/gate_v03_runtime.py contracts/CausalBond.py
```

27 checks against the real py-genlayer **v0.3.0-rc7**, in-memory, no network:

```
[1] constructor        3   __init__, storage auto-allocation, counters
[2] _now_unix          6   compared against calendar.timegm on five instants,
                           including 29 Feb 2024 and 1 Mar 2000
[3] create_mandate     6   case id, counter, principal, prime, authority, derive
[4] revert branches   10   duplicate ref, empty ref, bad address, clause JSON,
                           clause array, clause count, clause object, clause kind,
                           duplicate kind, bool-not-int value
[5] role control       2   ONLY_PRIME_AGENT, ONLY_PRINCIPAL
GATE: ALL PASS
```

`scripts/probe_v03_schema.py` runs the narrower check the network performs before
a deploy — module load plus schema extraction: `SCHEMA: OK methods=16 (view=4,
write=12)`.

## What the offline gates do NOT cover

- Everything through `gl.vm.run_nondet` / `gl.nondet.exec_prompt`: the `CARRIES` /
  `DOES_NOT_CARRY` decision per clause per edge.
- **Every native transfer.** Direct Mode's message mock does not capture
  `emit_transfer`, and the v0.3 in-memory gate does not either. Bond locking, bond
  release, principal slash and liability settlement are unproven offline by
  construction.

CausalBond holds and moves real GEN, so that second gap matters more here than in
a read-only contract. It has to be closed on Studio Next with transaction hashes.

## On-chain test procedure — executed

**Five** distinct wallets, not four. The contract forbids any address appearing
twice in the delegation chain (`CHAIN_AGENT_REUSE_FORBIDDEN`,
`PRINCIPAL_CANNOT_BE_CHILD`, `RECEIPT_AUTHORITY_CANNOT_BE_CHAIN_AGENT`,
`CHILD_MUST_DIFFER_FROM_PARENT`), and the scenario needs two delegation layers to
show liability landing on the second one rather than on the prime.

| # | Wallet | Action | Observed |
|---|---|---|---|
| 1 | principal | `create_mandate`, 2 clauses, bond 0.01 GEN/clause | `AWAITING_PRIME_ACCEPTANCE`, `required_bond_wei` = 0.02 GEN |
| 2 | prime | `accept_prime_mandate`, value = exact required bond | `ACTIVE`, `prime_bond_locked` = 0.02 GEN |
| 3 | prime | `record_handoff` → agent B, M1 keeps both obligations, value 0 | `HANDOFF_PENDING_ACCEPTANCE`, edge 1 uses the prime bond |
| 4 | agent B | `accept_handoff(1)` | edge 1 child-signed, executor moves to agent B |
| 5 | agent B | `record_handoff` → agent C, M2 drops the refund obligation, value 0.02 GEN | `HANDOFF_PENDING_ACCEPTANCE`, edge 2 posts its own bond |
| 6 | agent C | `accept_handoff(2)` | 2/3 handoffs signed |
| 7 | receipt authority | `submit_receipt` — refundable false, price 250, cancellation 48h, check-in unix | `EVALUATING_BREACH`, **1 breached clause**, computed with no model call |
| 8 | any | `evaluate_edge(clause 1, M1)` | `CARRIES` |
| 9 | any | `evaluate_edge(clause 1, M2)` | `DOES_NOT_CARRY` |
| 10 | any | `finalize_dispute` | `SETTLED_BREACH`, liability `EDGE_2`, three native transfers |

Price 250 is under the 300 cap, so the price clause is satisfied and the contract
never asks a validator about it. Exactly two semantic calls are made — one
breached clause × two signed handoffs.

### Settlement

| | |
|---|---|
| status | `SETTLED_BREACH` |
| liability | `EDGE_2` |
| carries vector | `[true, false]` |
| principal compensation | `10000000000000000` wei (0.01 GEN) |
| prime bond | returned in full — the first layer carried the obligation |
| edge 2 bond | 0.01 GEN slashed, remainder refunded |
| contract balance | `0.06 GEN` → `0.02 GEN` — the 0.04 this case locked, released in full |

Case `CB-DEMO-03`, case id `44c2dc32fef71b3bc0e458c76586d442f0c3173ecf4fd884e7be4092d6bc8a40`.

```
settlement call                                0x8e9a76041f60db4d7efb7a09fd336189a388bd07f1448db1f50369a075719224
transfer -> principal (compensation 0.01 GEN)  0xec075cb5d0811440e4c73a9bc2a3835f428f4535a97badc8c33a3a82678bba60
transfer -> prime     (refund 0.02 GEN)        0xaa31fddf69268e6f709b15aeef79e19a07d92993b7d8b4810a2304314f529ddb
transfer -> edge 2    (refund 0.01 GEN)        0xca7433c6971a5b41c88eda072c5f3b3eb7e2353f9b8ce15afa6411e6bfea42a7
```

The contract does not end at zero, and that is the correct reading: it holds
bonds per case, not in one pool. This case locked 0.04 GEN and got all of it
back out. The residual 0.02 GEN belongs to a separate earlier case that was never
settled, and no part of this settlement could touch it.

Outgoing transfers execute on **finalization**, not on acceptance: the contract
balance is unchanged while the settlement transaction sits at `ACCEPTED` and only
drops to zero once it reaches `FINALIZED`.

### Consensus v0.6 message fees — a real blocker, and how it was closed

The first settlement attempts failed, and the failure is worth recording because
it is invisible to every offline gate:

```
fee no_matching_allocation # external
Mode1MessageFeesRequireGenVMPerEmissionSupport:
    fee-bearing GenVM messages require a message allocation tree
```

Under Consensus v0.6 a contract that emits an outgoing message must have that
message covered by a **message allocation tree** declared by the signer up front.
A transaction submitted with the default fee distribution declares
`totalMessageFees: 0`, so the node has nothing to match the transfer against and
aborts the execution — before any settlement logic runs. The contract was never
at fault; the declaration was missing on the client side.

The allocations cannot be guessed, because they depend on which messages the call
actually emits. `src/settle.ts` therefore routes the five money-moving methods
through `estimateTransactionFeesForWrite`, which simulates the call, observes the
emitted messages, and returns the allocation tree that `writeContract` then
signs. If the simulation reports no outgoing messages, the app refuses to sign
rather than submitting a transaction that would fail at execution.

The five methods on that path: `finalize_dispute`, `settle_no_breach`,
`force_prime_fallback_after_evaluation_timeout`, `close_after_execution_deadline`,
`cancel_unaccepted_handoff`.

### Reading results correctly

A transaction reaching `ACCEPTED` in the consensus history is **not** a success
signal — a failed transaction walks the same path. This run produced a live
example of exactly that: a transaction with `CONSENSUS RESULT: Accepted` and
`GENVM RESULT: ERROR`.

```
accepted-but-failed transaction   0x910e0d32...b18bf9a1
```

That transaction is from an earlier run against this same contract, not from the
run tabulated above — every call in this run succeeded. It is cited because it is
the clearest available evidence of the distinction, not as part of this run's
results.

The authority is the postcondition: re-read `get_case` and compare. The app does
this after every write and reports nothing as done until the read-back matches.

### Source parity

```bash
npm run verify:deployed
```

Fetches the deployed code over RPC and compares it against `contracts/CausalBond.py`.
The expected hash is computed from the repository file at run time, so the check
cannot drift from the source it claims to verify. The comparison is newline-aware
(CRLF and a missing trailing newline both still match).

### UI regression gate

```bash
npm i -D playwright && npx playwright install chromium
npm run gate:ui
```

Loads the real `src/styles.css` into a headless browser, rebuilds the DOM nesting
the app produces, and clicks. It exists because a page-wide pending lock once
disabled the signing panel's own Approve and Cancel buttons, leaving a reload as
the only escape. Playwright is deliberately **not** a dependency of this project —
it would be installed on every deployment build for no runtime benefit.
