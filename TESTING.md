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

Observed on the unchanged contract source used by this R4 package:

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

A dependency-installed Vite build should be rerun in the release environment after any frontend-only patch; do not infer it from source transpilation alone.

## GenVM lint and Direct Mode

The exact contract SHA `52522a405a536ff385d888efa29eb6acbda02f5686656275c1565555be83c76e` received an executed GenVM tooling pass before deployment:

```text
genvm-lint check: PASS (3 checks)
schema: 16 methods / 12 writes present
typecheck: PASS
```

Direct Mode on `genlayer-test==0.29.2` exposed a harness limitation: `VMContext.warp()` does not refresh `gl.message_raw["datetime"]`. The shipped suite uses a small `chain_warp()` helper that updates the same transaction-datetime field after `warp()`, making deadline branches reachable without changing contract code. The exact contract source was independently exercised against the official Direct Mode fixtures, including no-receipt timeout, receipt-confirmed timeout exclusion, unsigned-edge handling, authority separation, and responsibility routing.

Re-run before deployment:

```bash
pytest -q tests/direct/test_causalbond.py
```

Native transfer recipient/value proof remains a StudioNet runtime requirement because the Direct Mode message mock does not capture `emit_transfer`.

## Required StudioNet runtime evidence

Before public finalization, execute at least:

1. create a 2–4 clause case and confirm persisted transaction timestamps/deadlines;
2. reject `receipt_authority == principal`;
3. reject `receipt_authority == prime`;
4. reject using the receipt authority as a handoff child;
5. wrong-role prime acceptance rollback;
6. exact prime bond acceptance;
7. first signed handoff using the prime bond;
8. later handoff with exact downstream bond;
9. wrong-child acceptance rollback;
10. pending unsigned handoff does not block receipt submission and never enters evaluation;
11. structured no-breach receipt → no semantic call → bond release;
12. structured breach receipt → deterministic breached-clause set;
13. one `CARRIES` semantic cell and one `DOES_NOT_CARRY` semantic cell;
14. restoration scenario proving an earlier temporary loss is not selected;
15. persistent loss scenario proving the responsible edge is selected;
16. faithful-chain breach proving `PRIME_LIABLE`;
17. multi-clause breach proving per-clause slashing;
18. no-receipt timeout proving **bond return with zero principal compensation**;
19. incomplete-evaluation timeout proving prime fallback only after a real breached receipt exists;
20. terminal replay/close rollback;
21. native GEN recipient/balance effects for slash compensation and refunds;
22. every browser write path proves its finalized-state postcondition on StudioNet;
23. exact deployed-source parity.

Runtime proof must distinguish contract execution from wallet/RPC/signing failures and must not infer a successful or reverted contract path from transaction finalization alone.

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
