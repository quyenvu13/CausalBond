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
pytest -q tests/direct/test_causalbond.py
```

Direct Mode covers deadline, role, malformed-input, restoration, fallback, and recovery branches on the exact contract source. Native transfer recipient/value effects are proven separately on StudioNet because the Direct Mode message mock does not capture `emit_transfer`.

## Runtime coverage boundary

The executed StudioNet primary path proves the load-bearing economic flow: exact prime bond acceptance, signed Edge 1 and Edge 2 delegation, a structured receipt with one deterministic breach, one `CARRIES` and one `DOES_NOT_CARRY` semantic result, deterministic `EDGE_2` liability, native slash compensation, native refunds, terminal settlement, and zero remaining contract balance.

Malformed, unauthorized, timeout, no-receipt, restoration, multi-clause, replay, and other attack branches are covered by the exact-source local and Direct Mode regression suites listed above. Runtime evidence distinguishes contract execution from wallet/RPC/signing failures and does not infer contract success from finalization alone.

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
