# CausalBond — security decisions

## 1. Original-baseline comparisons only

Adjacent comparisons are not used. Every accepted mandate is evaluated against the original M0 clause. This prevents salami drift and avoids falsely blaming an early edge when a later mandate restores the obligation.

## 2. Boolean semantic primitive

Validators answer only whether one mandate still requires one original obligation. The contract performs localization from that boolean vector. No N-way semantic attribution is requested.

## 3. Structured outcome predicate

The MVP is constrained to travel-booking fields that can be compared deterministically. Validators never decide whether the receipt breached M0.

## 4. Independent receipt role

The receipt authority must differ from the principal and prime and cannot later become a chain agent. This closes direct self-certification and principal-controlled silence/seizure paths. It does not claim that distinct wallets cannot collude.

## 5. Child signature before activation

Recording a handoff is insufficient. Only the designated child can accept that exact recorded mandate, and only then does the child become current executor.

## 6. Pending handoff cannot block receipt

A recorded but unsigned final handoff is not part of the signed chain and therefore cannot prevent the independent receipt authority from submitting. It is excluded from semantic evaluation; any separately posted bond is handled by settlement/refund.

## 7. Pre-posted economic consequence

The prime posts a full clause-sized bond before work begins. Later delegation parents also lock the full required amount for downstream edges. A responsible accepted edge can therefore be slashed without asking an external party to pay after the fact.

## 8. Prime liability when delegation is not responsible

A real structured breach does not become consequence-free merely because every signed handoff preserved the original obligation. In that case the prime bond compensates the principal.

## 9. No receipt is not a breach

Silence by the receipt authority is not enough to establish an outside-world failure. If the execution window expires without an authenticated receipt, all locked bonds are returned and the case closes without principal compensation.

## 10. Permissionless evaluation and settlement

Semantic cell evaluation and finalization do not require the principal, prime, or receipt authority once the relevant receipt state exists. This reduces hostage/liveness risk.

## 11. Fail-closed semantic uncertainty

Unknown or malformed model output maps to `DOES_NOT_CARRY`; it never silently produces `CARRIES`.

## 12. Deterministic transaction clock

Deadline state is derived only from `gl.message_raw["datetime"]` with pure integer conversion. Validator-local wall clock functions are forbidden by policy checks.

## 13. Finalized-state browser postconditions

The UI never treats StudioNet finalization alone as proof that a write succeeded. A present failure enum aborts immediately; otherwise each action verifies the expected finalized contract-state transition before reporting success.

## 14. Honest provenance claim

CausalBond authenticates the wallet that submits the structured receipt. It does not claim that authentication proves the off-chain facts themselves.
