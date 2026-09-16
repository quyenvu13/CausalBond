#!/usr/bin/env bash
# Source/deployment parity for the Studio Next deployment.
#
# Compares the source the network actually holds against contracts/CausalBond.py.
# Newline-aware: normalize CRLF/CR and one optional terminal LF only.
# Raw byte identity is reported separately; substantive source changes still fail.
#
#   bash scripts/verify_deployed_source.sh
#   bash scripts/verify_deployed_source.sh 0xOTHERADDRESS
set -euo pipefail

RPC="${GENLAYER_RPC:-https://studio-next.genlayer.com/api}"
ADDR="${1:-0x12d17759F94d59E662126c683D67de56Ec4F903D}"
SRC="${CONTRACT_PATH:-contracts/CausalBond.py}"

if [ ! -f "$SRC" ]; then
  echo "Contract source not found: $SRC" >&2
  exit 2
fi

EXPECTED_CANONICAL="$(python3 -c "
import hashlib,sys
data = open(sys.argv[1],'rb').read().replace(b'\r\n', b'\n').replace(b'\r', b'\n')
data = data.removesuffix(b'\n')
print(hashlib.sha256(data).hexdigest())
" "$SRC")"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

post() {
  curl -fsS -X POST "$RPC" -H 'Content-Type: application/json' -d "$1" > "$TMP"
}

ok_result() {
  python3 - "$TMP" <<'PY'
import json, sys
try:
    obj = json.load(open(sys.argv[1], encoding='utf-8'))
except Exception:
    raise SystemExit(1)
if obj.get('error') or obj.get('result') in (None, '', {}):
    raise SystemExit(1)
raise SystemExit(0)
PY
}

echo "CausalBond deployed-source parity check (newline-aware)"
echo "RPC:      $RPC"
echo "Contract: $ADDR"
echo "Source:   $SRC"
echo "Expected canonical SHA256: $EXPECTED_CANONICAL"
echo

P1="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"gen_getContractCode\",\"params\":[\"$ADDR\"]}"
P2="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"gen_getContractCode\",\"params\":[\"$ADDR\",\"finalized\"]}"
P3="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"gen_getContractCode\",\"params\":[{\"address\":\"$ADDR\",\"status\":\"finalized\"}]}"

if post "$P1" && ok_result; then
  MODE='address-only'
elif post "$P2" && ok_result; then
  MODE='address + finalized'
elif post "$P3" && ok_result; then
  MODE='request object'
else
  echo 'RPC did not return contract code.'
  cat "$TMP"; echo
  exit 2
fi

echo "RPC request mode: $MODE"
echo

python3 - "$TMP" "$EXPECTED_CANONICAL" "$SRC" <<'PY'
import base64, hashlib, json, sys

path, expected_lf, source_path = sys.argv[1:]
expected_raw = hashlib.sha256(open(source_path, "rb").read()).hexdigest()
obj = json.load(open(path, 'r', encoding='utf-8'))
if obj.get('error'):
    raise SystemExit(f"RPC error: {obj['error']}")

result = obj.get('result')
if isinstance(result, dict):
    for key in ('code', 'source', 'contractCode'):
        if result.get(key):
            result = result[key]
            break
if not isinstance(result, str) or not result:
    raise SystemExit(f'Unexpected RPC result: {result!r}')

if result.startswith('0x'):
    raw_bytes = bytes.fromhex(result[2:])
else:
    try:
        raw_bytes = base64.b64decode(result, validate=True)
        if not raw_bytes:
            raise ValueError('empty payload')
    except Exception:
        raw_bytes = result.encode('utf-8')

normalized = raw_bytes.replace(b'\r\n', b'\n').replace(b'\r', b'\n')
# Studio may omit the terminal newline. Remove at most ONE final LF from
# both copies; every other byte must still match.
normalized = normalized.removesuffix(b'\n')
raw_hash = hashlib.sha256(raw_bytes).hexdigest()
norm_hash = hashlib.sha256(normalized).hexdigest()

print('Deployed bytes:            ', len(raw_bytes))
print('Raw deployed SHA256:       ', raw_hash)
print('Normalized deployed bytes: ', len(normalized))
print('Normalized deployed SHA256:', norm_hash)
print('Repository raw SHA256:    ', expected_raw)
print('Expected canonical SHA256:', expected_lf)
print()

first_line = normalized.split(b'\n', 1)[0].decode('utf-8', 'replace').strip()
print('Deployed first line:', first_line)
if not first_line.startswith('# v0.3'):
    print('WARNING: deployed source does not carry the v0.3 version comment.')
print()

if norm_hash != expected_lf:
    raise SystemExit('SOURCE PARITY MISMATCH — substantive source difference remains.')

if raw_hash == expected_raw:
    print('SOURCE PARITY PROVEN — byte-identical to the repository source.')
else:
    print('SOURCE PARITY PROVEN — identical after CRLF/LF and optional terminal-newline normalization.')
PY
