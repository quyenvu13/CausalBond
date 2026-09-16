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

## On-chain test procedure

Four distinct wallets: **principal**, **prime agent**, **child agent**, **receipt
authority**. All need GEN on Studio Next for fees, and the principal and prime
also need GEN for the bonds themselves.

| Step | Wallet | Action | Expected |
|---|---|---|---|
| 1 | principal | `create_mandate` with 2–4 clauses | case created, status locked at M0 |
| 2 | prime | `accept_prime_mandate`, value = `required_bond_wei` | prime bond locked |
| 3 | prime | `record_handoff` to the child, value = downstream bond | edge recorded, awaiting signature |
| 4 | child | `accept_handoff` | edge signed |
| 5 | authority | `submit_receipt` with a structured receipt | breached clause set computed deterministically |
| 6 | any | `evaluate_edge` per (clause, edge) | `CARRIES` / `DOES_NOT_CARRY` per cell |
| 7 | any | `finalize_dispute` | liability routed, native transfers emitted |

Capture the transaction hash **and** the contract-state read-back for each step,
plus the contract balance before and after step 7. Then set
`VITE_RUNTIME_EVIDENCE` so the Verification page shows that run instead of an
empty state.

### Reading results correctly

A transaction reaching `ACCEPTED` in the consensus history is **not** a success
signal — a failed transaction walks the same path. The authority is the
postcondition: re-read `get_case` and compare. The app does this automatically and
reports nothing as done until the read-back matches.
