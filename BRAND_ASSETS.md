# CausalBond — brand assets

## Identity

CausalBond uses a liability command-center / bonded-routing identity:

- deep navy and near-black protocol surfaces;
- cyan / cobalt for active protocol paths and signed custody;
- periwinkle / ice-blue for routing and bonded-state accents;
- coral only for breach / dropped-obligation states;
- a horizontal protocol dock rather than a fixed application sidebar;
- an orbital mandate-custody map and vertical protocol ledger as the primary overview motifs;
- clear modern sans typography with mono micro-labels for hashes, state, and protocol metadata.

The visual metaphor follows the protocol model: M0 is the anchor, signed mandates travel through custody, and deterministic routing assigns the bonded consequence.

## Logo

- `public/logo.svg` — canonical vector logo.
- `public/logo.png` — 512×512 PNG export for submission forms and platforms that require raster artwork.

Both use linked orbital rings with cyan and periwinkle nodes. The assets have no external dependency.

## UI rule

Transaction/action forms open empty. Historical runtime state belongs only in Inspect / Verification after a user explicitly loads a case. When a write has already completed in finalized state, that action is removed from the active surface and replaced by a read-only completion state to reduce accidental replay or double-click ambiguity.
