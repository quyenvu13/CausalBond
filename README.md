# CausalBond

**Bonded delegation accountability for signed AI-agent handoffs on GenLayer.**

CausalBond starts from a principal's original machine-checkable obligations (`M0`), requires a prime agent to pre-post a native GEN bond, and supports up to three downstream signed handoffs. Every child must explicitly accept the exact mandate text before becoming the current executor.

The receipt role is intentionally independent. A strict structured outcome receipt determines which original clauses were breached. GenLayer validators then answer only one bounded question for each breached clause × accepted handoff:

> Does this child-accepted mandate still require the original obligation?

The wire result is only `CARRIES` or `DOES_NOT_CARRY`. The contract performs responsibility localization, restoration handling, slashing arithmetic, refunds, and prime-liable fallback deterministically.

## StudioNet deployment

- Network: GenLayer StudioNet
- Contract: `0x01a6BEab9324ACFADa32Af8cc1070049E0e97Da3`
- Contract source: `contracts/CausalBond.py`
- Contract SHA-256: `52522a405a536ff385d888efa29eb6acbda02f5686656275c1565555be83c76e`
- Primary runtime case: `97d8b5c551db611fe26559622798849f1394f2019249e01e75dfe3f431b3a04f`

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

## Executed StudioNet proof

The primary runtime path was executed against the deployed contract:

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

The browser does not treat transaction finalization alone as execution success when StudioNet omits `txExecutionResultName`; each write reloads finalized contract state and verifies an action-specific postcondition.

Run locally:

```bash
npm install
npm run build
npm run dev
```

`VITE_CONTRACT_ADDRESS` defaults to the deployed StudioNet contract and can be overridden through environment configuration.

## Executed repository gates

```text
Python compile                  PASS
AST / policy gate               PASS
Core logic                      27/27 PASS
Adversarial logic               18/18 PASS
Prompt fence                    0/12 bypasses
Mutation matrix                 23/23 caught
GenVM lint/schema/typecheck     PASS on exact contract SHA
Direct Mode regressions         8/8 PASS on real GenVM (pinned v0.2.12)
```

Two of those eight rebuild the executed StudioNet settlement on GenVM — the
deterministic breach predicate, the per-edge carries vector, the responsibility
routing that produced `EDGE_2` liability, the slash total, and every bond
released to zero — plus the prime-fallback case where a genuine breach occurs and
no delegation edge dropped the obligation. The native transfers themselves are
proven on StudioNet with transaction hashes, because Direct Mode's message mock
does not capture `emit_transfer`.

See `TESTING.md`, `RUNTIME_VERIFICATION.md`, `SECURITY_ASSURANCE.md`, `SECURITY_DECISIONS.md`, and `LOCKED_SPEC.md`.
