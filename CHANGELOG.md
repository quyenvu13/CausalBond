# Changelog

## 2.0.0-studionext — 2026-09-15

Rebuilt for **GenLayer Studio Next** (Consensus v0.6). The previous build targeted
StudioNet with GenVM v0.2 and does not run on this network.

### Contract — ported v0.2 → v0.3

- header: added `# v0.3.0`, runner pin moved to
  `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`
- `from genlayer import *` → `import genlayer as gl` + `from genlayer.types import *` +
  `from genlayer.storage import TreeMap` (v0.3 no longer binds `gl` through the star import)
- `gl.Contract` → `gl.contract.Contract`
- `gl.vm.run_nondet_unsafe` → `gl.vm.run_nondet`
- `gl.message_raw["datetime"]` → `gl.message.raw["datetime"]` (2 sites)
- removed `self.cases = TreeMap()` from `__init__` — v0.3 allocates storage fields from the
  storage layout and raises `GenerationError` on an explicit constructor

`@gl.evm.contract_interface`, `@gl.public.write.payable`, `gl.message.value` and
`emit_transfer(value=…)` were checked against the v0.3 SDK and are unchanged.

No logic, constant, prompt, fence or state-machine change. sha256
`52522a40…83c76e` → `d8fa1337…3fcf83a`. Redeployed at
`0x12d17759F94d59E662126c683D67de56Ec4F903D`.

### Frontend

- `genlayer-js` 1.1.8 → 2.0.0-rc.1
- writes moved to `@genlayer/transaction-kit` + `@genlayer/transaction-kit-react` 0.1.0-rc.2.
  `src/txgate.tsx` exposes the flow as a promise, so every existing call site keeps its
  `await writeAndFinalize(…)` shape and its own postcondition check; the two payable writes
  (`accept_prime_mandate`, `record_handoff`) pass the bond through the kit's `userValue`
- single network definition in `src/network.ts` shared by reads, MetaMask and the kit
- added `ensureNetwork()`: genlayer-js skips its chain assertion for Studio chains, so the
  wallet's chain is now checked before anything is signed
- removed `client.connect('studionet')`, which pulled in the MetaMask Snap handshake
- **removed the hardcoded runtime evidence** from the Verification page — a case id and three
  transaction hashes from the StudioNet deployment, which do not exist on this one. Now read
  from `VITE_RUNTIME_EVIDENCE`, unset by default, with an honest empty state
- wallet button doubles as an account switcher; CausalBond needs four distinct roles
- added `vercel.json` and `.env.example`

### Testing

- `scripts/test_contract_logic.py` ported to the v0.3 stub shape. This was load-bearing:
  `fence_probe.py` imports the same stub and `mutation_matrix.py` scores on both suites, so
  the unported harness would have left the mutation baseline red and `23/23 caught` meaningless
- added `scripts/gate_v03_runtime.py` — 27 checks against the real py-genlayer v0.3.0-rc7 SDK
- the previous evidence pack does **not** carry over and is not claimed here
