# CausalBond

**Bonded delegation accountability for signed AI-agent handoffs on GenLayer.**

## Demo video

**▶ Watch the demo: https://www.youtube.com/watch?v=8S5jAaUOPmg**

What the app does, and the verification flow walked end to end against the
deployed contract — including the settlement that moves real GEN, with the
contract balance read before and after.

CausalBond starts from a principal's original machine-checkable obligations (`M0`), requires a prime agent to pre-post a native GEN bond, and supports up to three downstream signed handoffs. Every child must explicitly accept the exact mandate text before becoming the current executor.

The receipt role is intentionally independent. A strict structured outcome receipt determines which original clauses were breached. GenLayer validators then answer only one bounded question for each breached clause × accepted handoff:

> Does this child-accepted mandate still require the original obligation?

The wire result is only `CARRIES` or `DOES_NOT_CARRY`. The contract performs responsibility localization, restoration handling, slashing arithmetic, refunds, and prime-liable fallback deterministically.

## Deployment

- Network: **GenLayer Studio Next** (Consensus v0.6)
- RPC: `https://studio-next.genlayer.com/api`
- Chain ID: `61997`
- Contract: `0x12d17759F94d59E662126c683D67de56Ec4F903D`
- Contract source: `contracts/CausalBond.py`
- Contract SHA-256: `d8fa13373036e87250bdd51099c8f26c935a4fc02c3d4369087d953dd3fcf83a`
- GenVM: `v0.3.0-rc7`, runner `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`

## Why the design is narrow

CausalBond does **not** ask validators to choose a responsible agent from an entire chain. Every semantic call compares one signed mandate against one original clause. Responsibility selection remains deterministic contract logic.

Every mandate is compared with `M0`, never with the adjacent parent. A temporary loss that is later restored is not treated as a delegation breach. A loss that remains absent through execution is routed to the first responsible accepted edge. If every accepted handoff still carries a receipt-confirmed breached obligation, liability falls back to the prime bond.

## Structured MVP scope

The travel-booking MVP supports 2–4 original clauses chosen from:

- `REFUNDABLE_REQUIRED`
- `MAX_TOTAL_PRICE_USD`
- `MIN_CANCELLATION_HOURS`
- `LATEST_CHECKIN_UNIX`

CausalBond authenticates which wallet submitted the structured receipt; it does not independently prove that the receipt describes external reality.

## Contract lifecycle

1. `create_mandate(...)` — principal locks immutable M0, roles, bond policy, and execution window.
2. `accept_prime_mandate(case_id)` — prime accepts and posts the exact required native GEN bond.
3. `record_handoff(...)` — current executor records a child and exact mandate; Edge 1 uses the prime bond, later edges post their own exact bond.
4. `accept_handoff(...)` — designated child signs the stored mandate before executor rotation.
5. `submit_receipt(...)` — independent authority submits the strict structured receipt; breached clauses are derived deterministically.
6. `evaluate_edge(...)` — permissionless bounded semantic evaluation for one breached clause × one accepted handoff.
7. `finalize_dispute(...)` — deterministic scan selects liability, compensates the principal, and refunds unused bond value.
8. Recovery/timeout methods prevent funds from depending on a single actor forever.

## The primary runtime path

This is the sequence the contract is built to enforce, and the one to execute
against the deployment above. Runtime evidence for **this** deployment has not
been re-established yet — see "Runtime evidence" below.

- M0: refundable booking and total price ≤ 300 USD.
- M1 preserved both obligations → `CARRIES` for refundable.
- M2 removed refundability while preserving price → `DOES_NOT_CARRY` for refundable.
- Structured receipt: `refundable=false`, `total_price_usd=250` → exactly one breached clause.
- Boolean vector: `[CARRIES, DOES_NOT_CARRY]`.
- Deterministic result: `EDGE_2`.
- Terminal state: `SETTLED_BREACH`.
- Principal compensation: `0.01 GEN`.
- Prime refund: `0.02 GEN`.
- Edge-2 parent remainder refund: `0.01 GEN`.
- Contract balance after settlement: `0 GEN`.

The three native outbound transfers are recorded in `RUNTIME_VERIFICATION.md`.

## Frontend

The interface uses a liability command-center visual system: a horizontal protocol dock, deep navy command surfaces, cyan/cobalt custody paths, periwinkle routing accents, an orbital mandate map, and the obligation-routing matrix.

Action forms are empty by default. Completed writes disappear from active action surfaces and are replaced by read-only finalized-state indicators, reducing replay and double-click ambiguity.

The browser never treats a decided transaction as execution success — a failed transaction reaches `ACCEPTED` too. Each write reloads contract state and verifies an action-specific postcondition before reporting anything.

Run locally:

```bash
npm install
npm run build
npm run dev
```

`VITE_CONTRACT_ADDRESS` defaults to the deployed Studio Next contract and can be overridden through environment configuration. Every network value lives in `src/network.ts` and is shared by reads, MetaMask and Transaction Kit, so an RPC override can never sign for a chain other than the one being read.

## Executed repository gates

```text
Python compile                  PASS
AST / policy gate               PASS
Core logic                      27/27 PASS
Adversarial logic               18/18 PASS
Prompt fence                    0/12 bypasses
Mutation matrix                 23/23 caught
GenVM lint/schema/typecheck     PASS on exact contract SHA
v0.3 runtime gate               27 checks PASS on py-genlayer v0.3.0-rc7
```

```bash
npm run check          # ast -> logic -> adversarial -> fence -> mutations -> build
npm run gate:contract  # the v0.3 SDK gate (see scripts/setup_v03_sdk.sh)
```

The mutation matrix is scored on three independent gates and its unmutated
baseline is green on all three, so `23/23` reflects three different detectors
rather than one constant column.

## Runtime evidence

Nothing was carried over from the previous network. The old transaction hashes
belong to a different deployment, and the GenVM v0.2 toolchain that produced them
— `genlayer-test` Direct Mode pinned to v0.2.12, `genvm-linter` 0.11.0 — cannot
load a v0.3 contract at all.

Native transfers are the one thing no offline gate can cover: Direct Mode's
message mock does not capture `emit_transfer`, and neither does the in-memory
v0.3 gate. Bond locking, bond release and liability settlement are unproven
offline **by construction**, so they were executed on Studio Next instead.

A full delegation chain has now been run end to end on this deployment: five
distinct wallets, two signed handoffs, a structured receipt, two bounded semantic
calls, and a settlement that moved GEN out of the contract. Liability routed to
the second handoff — the one whose mandate dropped the refund obligation — and
the contract balance went from `0.04 GEN` to `0`.

Transaction hashes for that run are in `TESTING.md`, and the app's Verification
page reads them from `VITE_RUNTIME_EVIDENCE`. With that variable unset the page
shows an empty state rather than figures from somewhere else.

See `TESTING.md`, `SECURITY_ASSURANCE.md`, `SECURITY_DECISIONS.md`, and `LOCKED_SPEC.md`.
