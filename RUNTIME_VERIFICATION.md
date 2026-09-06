# CausalBond — StudioNet runtime verification

## Deployment

- Contract: `0x01a6BEab9324ACFADa32Af8cc1070049E0e97Da3`
- Contract source SHA-256: `52522a405a536ff385d888efa29eb6acbda02f5686656275c1565555be83c76e`
- Runtime case: `97d8b5c551db611fe26559622798849f1394f2019249e01e75dfe3f431b3a04f`

## Roles used

- Principal: `0x923a09d0D6e5C242e36C3c1D2071835917cC0bDF`
- Prime: `0x188f15bC55302ff2d55f0107300499aed23a831E`
- Receipt authority: `0x3b097922A159B8D81197F0b0d19ef3f29D2B3c8b`
- Edge-1 child / Edge-2 parent: `0x7F8150A525C348CdD3F9F63B08Ab0499dcaEC2ec`
- Edge-2 child: `0xB6d5876ee86c1E61f30f53eFF9728d6fd9848Bd4`

## Runtime state

M0 clauses:

1. `REFUNDABLE_REQUIRED = true`
2. `MAX_TOTAL_PRICE_USD = 300`

Accepted mandates:

- M1: `Book a refundable hotel with total price no more than 300 USD.`
- M2: `Book any hotel with total price no more than 300 USD.`

Receipt:

```json
{
  "refundable": false,
  "total_price_usd": 250,
  "cancellation_hours": 24,
  "checkin_unix": 1790000000
}
```

Finalized `get_case` state proved:

- `breached_clause_indexes = [0]`
- `evaluations["0:1"] = "CARRIES"`
- `evaluations["0:2"] = "DOES_NOT_CARRY"`
- `responsible_edge = 2`
- `liability = "EDGE_2"`
- `principal_compensation_wei = "10000000000000000"`
- `status = "SETTLED_BREACH"`
- `prime_bond_locked = "0"`
- every edge `bond_locked = "0"`

## Native GEN settlement

All outbound transfer transactions were FINALIZED on StudioNet:

1. Principal compensation
   - Tx: `0x36f7ce0e91c0adc717e1cf21632941b34a3b087f164d68aaf5d34682ac2b54e9`
   - From: contract
   - To: principal `0x923a09d0D6e5C242e36C3c1D2071835917cC0bDF`
   - Value: `0.01 GEN`

2. Prime refund
   - Tx: `0xcf4c01a145b45c6ac2afe040d9814dc3412240d84de565fe9e7b7b6d981e7277`
   - From: contract
   - To: prime `0x188f15bC55302ff2d55f0107300499aed23a831E`
   - Value: `0.02 GEN`

3. Edge-2 parent remainder refund
   - Tx: `0xebc5c4e34c86f8f9974a0360fdc6fdbd049645f5544154a47f5e658c5fd8aa3c`
   - From: contract
   - To: `0x7F8150A525C348CdD3F9F63B08Ab0499dcaEC2ec`
   - Value: `0.01 GEN`

The contract account showed `0 GEN` after settlement, matching the total `0.04 GEN` locked across the prime and downstream bond sources.

## Scope of this evidence

This runtime case proves the primary load-bearing path: signed delegation, bounded semantic evaluation, deterministic responsibility routing, targeted slash compensation, unused-bond refunds, and native GEN settlement. Timeout and malformed/unauthorized branches are covered by the repository's exact-source local and Direct Mode regression suites unless separately executed live.
