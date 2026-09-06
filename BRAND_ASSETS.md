# CausalBond — brand assets

## Identity

CausalBond uses an orbital custody / bonded-routing identity designed to be visually distinct from the other project interfaces:

- deep navy and near-black protocol shell;
- cyan / cobalt for active protocol paths and signed custody;
- amber / gold for bonded value and routed liability;
- coral only for breach / dropped-obligation states;
- intersecting orbit rings, custody nodes, and the obligation matrix as the core visual motifs;
- clear modern sans typography with mono micro-labels for hashes, state, and protocol metadata.

The visual metaphor is not a generic neon dashboard: M0 is the anchor, signed mandates travel through an orbital custody path, and liability is routed to the responsible bonded edge.

## Logo

`public/logo.svg` is the canonical repository logo. It uses two linked orbital rings with cyan and amber nodes to match the custody / delegation visual system. It has no external asset dependency.

## UI rule

Transaction/action forms open empty. Historical runtime state belongs only in Inspect / Verification after a user explicitly loads a case. When a write has already completed in finalized state, that action is removed from the active surface and replaced by a read-only completion state to reduce accidental replay or double-click ambiguity.
