# CausalBond — deployed R4 summary

CausalBond is a bonded delegation-accountability protocol for signed AI-agent handoffs. Original obligations remain the semantic anchor, validators answer only bounded `CARRIES` / `DOES_NOT_CARRY` questions, and the contract deterministically routes native GEN bond consequences.

## Deployment

- StudioNet contract: `0x01a6BEab9324ACFADa32Af8cc1070049E0e97Da3`
- Contract SHA-256: `52522a405a536ff385d888efa29eb6acbda02f5686656275c1565555be83c76e`
- Primary runtime case: `97d8b5c551db611fe26559622798849f1394f2019249e01e75dfe3f431b3a04f`

## Runtime result

The executed case produced `M1=CARRIES`, `M2=DOES_NOT_CARRY`, deterministic `EDGE_2` liability, `SETTLED_BREACH`, `0.01 GEN` principal compensation, `0.02 GEN` prime refund, `0.01 GEN` Edge-2 parent refund, and a final contract balance of `0 GEN`.

## R4 frontend

R4 changes only presentation and finalized-action UX. It uses a new orbital custody identity (deep navy, cyan/cobalt, amber) and removes already-completed writes from active action surfaces. The contract remains frozen and byte-identical to the deployed runtime-tested source.
