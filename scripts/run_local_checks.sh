#!/usr/bin/env bash
set -euo pipefail
python -m py_compile contracts/CausalBond.py scripts/*.py
python scripts/check_contract_ast.py
python scripts/test_contract_logic.py
python scripts/test_contract_logic.py --suite adversarial
python scripts/fence_probe.py
python scripts/mutation_matrix.py
