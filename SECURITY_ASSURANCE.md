# CausalBond — security assurance

## Semantic boundary

The model does not choose a defendant, decide whether the booking outcome is bad, select a clause, compute money, or choose a recipient. It receives one original clause plus one child-accepted mandate and returns only `CARRIES` or `DOES_NOT_CARRY`.

Malformed, missing, exceptional, or uncertain semantic output fails closed to `DOES_NOT_CARRY`. Prompt-boundary tokens are stripped from mandate text before embedding it as untrusted data.

## Deterministic controls

The contract deterministically enforces:

- principal / prime / current-executor / child / receipt-authority roles;
- receipt-authority independence from the principal, prime, and chain agents;
- original clause schema and bounds;
- fixed chain depth;
- no repeated chain agents and no principal as child;
- exact native GEN bond amounts;
- handoff acceptance before executor rotation;
- transaction-datetime based deadlines with no validator-local wall clock;
- strict structured-receipt schema;
- breached-clause derivation;
- accepted clause × edge semantic matrix;
- duplicate-evaluation prevention;
- restoration-aware responsibility scan;
- position-to-stored-edge-index mapping before slashing;
- per-clause slashing, principal compensation, and unused-bond refunds;
- prime-liable fallback only after a receipt-confirmed breach;
- no-receipt bond return;
- timeout and terminal-state rules.

## Consequence audit

### Before prime acceptance

The principal may cancel because no bond has been accepted. Once the prime accepts and posts the bond, this cancellation path is permanently unavailable.

### Pending handoff

The edge parent may cancel an unaccepted handoff after its acceptance deadline. A later-edge bond is refunded because the child never signed. The first-edge path cannot refund or escape the already-locked prime bond.

A pending final handoff cannot hold the receipt authority hostage. `submit_receipt` is allowed from `ACTIVE` or `HANDOFF_PENDING_ACCEPTANCE`; only accepted edges enter semantic evaluation. If a pending later edge had a separately posted bond, that bond remains accounted for and is refunded by final settlement because the edge cannot receive a slash without child acceptance.

### No receipt by execution deadline

No authenticated receipt means the contract has no deterministic breach predicate. `close_after_execution_deadline` therefore returns all locked bonds and records `NO_RECEIPT_BONDS_RETURNED`; it does not convert receipt-authority silence into a breach or principal seizure.

### Receipt submitted

Once the receipt exists, `close_after_execution_deadline` is blocked. A no-breach receipt can only release bonds through `settle_no_breach`. A breach enters semantic evaluation.

### Semantic liveness

If the required matrix cannot finish before the evaluation deadline, the breached clauses are already known from the authenticated receipt. Those clauses deterministically fall back to prime liability; downstream bonds are refunded. Consensus failure therefore cannot lock funds forever or erase a breach consequence.

### Final settlement

All liability routing is derived from stored receipt breaches and stored `CARRIES` / `DOES_NOT_CARRY` decisions. Terminal states reject repeated close/settlement paths. Bond storage is zeroed before native transfers are emitted.

## Frontend transaction assurance

On StudioNet, finalized transaction objects may omit `txExecutionResultName`. The browser therefore uses two layers:

1. a present execution enum that is not `FINISHED_WITH_RETURN` is treated as failure;
2. when the enum is absent, every action reloads finalized contract state and checks a method-specific postcondition before showing success.

This avoids both false-positive success from finalization alone and false-negative failure on successful StudioNet writes that omit the enum. The browser exposes all 12 contract write paths, including cancellation, handoff timeout, evaluation-timeout fallback, and no-receipt close, so funds do not require an out-of-app recovery path.

## Residual trust and scope

The receipt authority is an authenticated source, not an oracle of external truth. Identity separation reduces obvious self-certification but does not prove that independently addressed parties are non-colluding. If both the prime and the independent receipt authority remain silent, no receipt-confirmed breach exists and the protocol returns bonds rather than inventing liability; the principal's protection is therefore only as strong as the off-chain reliability of the chosen receipt authority. The signed mandate chain proves what text was recorded and accepted on-chain, not what an external agent actually executed. The primary StudioNet settlement path has runtime evidence for consensus decisions and all three native GEN transfers. Timeout/liveness branches remain covered by exact-source local and Direct Mode regressions unless separately listed as live runtime evidence.
