# CausalBond — testing

## Local exact-source gates

From the repository root:

```bash
python -m py_compile contracts/CausalBond.py scripts/*.py
python scripts/check_contract_ast.py
python scripts/test_contract_logic.py
python scripts/test_contract_logic.py --suite adversarial
python scripts/fence_probe.py
python scripts/mutation_matrix.py
```

Observed on the unchanged deployed contract source:

```text
AST/POLICY: PASS
CORE: 27/27 PASS
ADVERSARIAL: 18/18 PASS
Prompt fence: 0/12 bypasses
Mutation matrix: 23/23 caught
```

The core suite covers creation, deterministic transaction time, receipt-authority independence, role boundaries, exact bond rules, child signatures, deterministic breach predicates, semantic matrix completion, restoration, multi-clause slashing, prime fallback, no-receipt bond return, evaluation timeout, refunds, max chain depth, and terminal states.

The adversarial suite covers malformed model output, prompt injection, unauthorized roles, schema abuse, duplicate/reused agents, authority-as-chain-agent rejection, pending-handoff grief resistance, evaluation of unsigned edges, duplicate semantic evaluation, early settlement, cancellation bypasses, wrong attached bond values, and deadline behavior.

The mutation matrix deliberately weakens 23 load-bearing checks, including the accepted-edge filter used by finalization, and requires the executable gates to catch every mutation.

## Frontend source check

`src/*.ts(x)` were syntax-transpiled with TypeScript and produced no syntax errors. A normal dependency-installed build remains the authoritative frontend build gate:

```bash
npm install
npm run build
```

A dependency-installed Vite build should be executed in the deployment environment; source transpilation alone is not treated as a production build result.

## GenVM lint and Direct Mode

The exact contract SHA `52522a405a536ff385d888efa29eb6acbda02f5686656275c1565555be83c76e` received an executed GenVM tooling pass before deployment:

```text
genvm-lint check: PASS (3 checks)
schema: 16 methods / 12 writes present
typecheck: PASS
```

Direct Mode on `genlayer-test==0.29.2` exposed a harness limitation: `VMContext.warp()` does not refresh `gl.message_raw["datetime"]`. The shipped suite uses a small `chain_warp()` helper that updates the same transaction-datetime field after `warp()`, making deadline branches reachable without changing contract code. The exact contract source was executed against the official Direct Mode fixtures, including no-receipt timeout, receipt-confirmed timeout exclusion, unsigned-edge handling, authority separation, and responsibility routing.

To reproduce the Direct Mode regression suite locally:

```bash
pytest -q tests/direct/
```

```text
8 passed
```

`tests/direct/conftest.py` pins the GenVM build (`v0.2.12`, overridable with
`GENVM_VERSION`). Without it, `direct_deploy` resolves "latest" at run time, so a
clean machine executes a runtime this contract was never verified against, and a
withdrawn release returns 404 instead of a test result.

`test_causalbond.py` covers deadline, role, malformed-input, restoration,
fallback, and recovery branches on the exact contract source.

`test_settlement_probe.py` covers the economic path. The native transfers
themselves cannot be asserted locally — `_emit` goes out through `emit_transfer`
on a `@gl.evm.contract_interface`, and the Direct Mode message mock does not
capture the outgoing message, which is why recipient and value effects are proven
on StudioNet instead. Everything up to the transfer is asserted here:

- `test_the_live_settlement_reproduces_on_genvm` rebuilds the executed StudioNet
  scenario — the same two clauses, the same structured receipt, one mandate
  carrying the obligation and one dropping it — and asserts the same results the
  live run recorded: `breached_clause_indexes = [0]`, `evaluations["0:1"] = CARRIES`,
  `evaluations["0:2"] = DOES_NOT_CARRY`, `responsible_edge = 2`,
  `liability = EDGE_2`, compensation equal to one `bond_per_clause`,
  `status = SETTLED_BREACH`, and every bond released to zero. The live settlement
  is therefore a regression test rather than a single observation.
- `test_prime_is_liable_by_fallback_when_no_edge_dropped_the_obligation` covers
  the case the design most has to get right: a genuine breach where every
  recorded mandate still carried the obligation. No delegation edge lost it, so
  liability must still land somewhere rather than nowhere — it falls back to the
  prime deterministically, `responsible_edge = 0`, `liability = PRIME_LIABLE`.

## Runtime coverage boundary

The executed StudioNet primary path proves the load-bearing economic flow: exact prime bond acceptance, signed Edge 1 and Edge 2 delegation, a structured receipt with one deterministic breach, one `CARRIES` and one `DOES_NOT_CARRY` semantic result, deterministic `EDGE_2` liability, native slash compensation, native refunds, terminal settlement, and zero remaining contract balance.

Malformed, unauthorized, timeout, no-receipt, restoration, multi-clause, replay, and other attack branches are covered by the exact-source local and Direct Mode regression suites listed above. The settlement arithmetic that produced the live payouts — breach predicate, per-edge carries vector, deterministic responsibility routing, slash totals and bond release — is additionally reproduced on real GenVM in `tests/direct/test_settlement_probe.py`, so the economic result does not rest on the single live run alone. Runtime evidence distinguishes contract execution from wallet/RPC/signing failures and does not infer contract success from finalization alone.

## Executed StudioNet primary runtime path

Deployment `0x01a6BEab9324ACFADa32Af8cc1070049E0e97Da3` was exercised with runtime case `97d8b5c551db611fe26559622798849f1394f2019249e01e75dfe3f431b3a04f`.

Observed finalized behavior:

```text
create_mandate                         PASS
accept_prime_mandate + native bond     PASS
Edge 1 record + child signature        PASS
Edge 2 payable bond + child signature  PASS
structured receipt breach detection    PASS
evaluate M1 -> CARRIES                 PASS
evaluate M2 -> DOES_NOT_CARRY          PASS
deterministic liability -> EDGE_2      PASS
terminal state -> SETTLED_BREACH        PASS
principal native payout 0.01 GEN        PASS
prime native refund 0.02 GEN            PASS
Edge-2 parent refund 0.01 GEN            PASS
contract balance after settlement 0 GEN PASS
```

See `RUNTIME_VERIFICATION.md` for the exact case and outbound transaction hashes.


## Live dApp liability-trail evidence

A second end-to-end walkthrough was executed through the deployed CausalBond dApp against the same frozen StudioNet contract. This evidence is organized as a **liability trail** rather than a transaction-by-transaction Studio trace: it shows the mandate chain, the receipt-confirmed breach, the two bounded semantic cells, deterministic liability routing, and the released bond state in the reviewer-facing interface.

- dApp case reference: `cb-dapp-proof`
- dApp Case ID: `cf51e92c1718257ee14d5ad8aa9b1933d471e98dcc1b44d0f03b5114edd8a8d7`
- Contract: `0x01a6BEab9324ACFADa32Af8cc1070049E0e97Da3`
- Contract SHA-256: `52522a405a536ff385d888efa29eb6acbda02f5686656275c1565555be83c76e`

Observed finalized checkpoints:

| Evidence | Finalized checkpoint |
|---|---|
| `A_M0_LOCKED.png` | M0 created with two original clauses; status `AWAITING_PRIME_ACCEPTANCE`; required prime bond `0.02 GEN` |
| `B_PRIME_BOND_ACTIVE.png` | Prime accepted the exact mandate and the case advanced to `ACTIVE` |
| `C_SIGNED_DELEGATION_CHAIN.png` | Edge 1 and Edge 2 were child-signed; M1 preserved refundability while M2 omitted it |
| `D_BREACH_ROUTE_OPEN.png` | Structured receipt produced exactly one deterministic breach; semantic matrix opened at `0/2` |
| `E1_M1_CARRIES.png` | M1 evaluated `CARRIES`; matrix progress `1/2` |
| `E2_M2_DOES_NOT_CARRY.png` | M2 evaluated `DOES_NOT_CARRY`; matrix progress `2/2` |
| `F_EDGE2_LIABILITY_SETTLED.png` | Deterministic routing selected `EDGE_2`; terminal status `SETTLED_BREACH` |
| `G_SETTLED_BONDS_ZERO.png` | Both signed handoff records remained visible with `bond 0 wei` after settlement |

Screenshots are stored under `evidence/liability-trail/`.

This dApp walkthrough is complementary to `RUNTIME_VERIFICATION.md`. The UI snapshots prove the finalized contract state and reviewer-facing liability path; the earlier StudioNet runtime record remains the source for the exact native outbound transfer transaction hashes and amounts. Transaction finalization alone is not treated as success: every checkpoint above was captured only after the dApp reloaded and verified the corresponding finalized post-state.
