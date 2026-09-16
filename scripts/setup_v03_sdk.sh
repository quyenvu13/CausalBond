#!/usr/bin/env bash
# Dựng SDK py-genlayer v0.3.0-rc7 THẬT để kiểm tra contract offline.
# Yêu cầu: python3.12+ (SDK dùng PEP 695 generics), git.
set -euo pipefail
ROOT="${1:-/tmp/genvm-v03}"
rm -rf "$ROOT" && mkdir -p "$ROOT"
git clone --quiet --filter=blob:none --no-checkout https://github.com/genlayerlabs/genvm.git "$ROOT/genvm"
cd "$ROOT/genvm"
git sparse-checkout init --cone
git sparse-checkout set runners
git checkout -q v0.3.0-rc7
# stub wasi: SDK chỉ cần FAKE_VM=True để chạy ngoài GenVM
mkdir -p "$ROOT/stub"
cat > "$ROOT/stub/_genlayer_wasi.py" <<'PY'
FAKE_VM = True
def __getattr__(name):
    def _f(*a, **k):
        raise RuntimeError("wasi stub: " + name)
    return _f
PY
echo "SDK  : $ROOT/genvm/runners/genlayer-py-std/src"
echo "STUB : $ROOT/stub"
echo
echo "Chạy:  PYTHONPATH=\"$ROOT/stub:$ROOT/genvm/runners/genlayer-py-std/src\" python3.13 scripts/probe_v03_schema.py <contract.py>"
