#!/usr/bin/env python3
"""
Gate: nạp contract bằng SDK py-genlayer v0.3.0-rc7 THẬT và trích schema.

Đây chính là bước mà Studio gọi qua RPC `gen_getContractSchemaForCode`.
Nếu bước này fail -> Studio hiện đúng ô đỏ "Could not load contract schema"
và không cho deploy.

Dùng:
  PYTHONPATH="<stub>:<sdk_src>" python3.13 scripts/probe_v03_schema.py contracts/MeaningNonce.py

Exit 0 = schema trích được. Exit 1 = fail, in ra traceback thật.
"""
import importlib.util
import json
import sys
import traceback


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: probe_v03_schema.py <contract.py>", file=sys.stderr)
        return 2
    path = sys.argv[1]

    try:
        import genlayer  # noqa: F401
    except Exception:
        print("FAIL: khong import duoc SDK v0.3. Chay scripts/setup_v03_sdk.sh truoc.",
              file=sys.stderr)
        traceback.print_exc()
        return 1

    spec = importlib.util.spec_from_file_location("contract_under_test", path)
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as exc:
        print("MODULE LOAD: FAIL")
        print("  " + type(exc).__name__ + ": " + str(exc))
        traceback.print_exc()
        return 1
    print("MODULE LOAD: OK")

    import genlayer as gl

    contracts = [
        obj
        for obj in vars(module).values()
        if isinstance(obj, type)
        and issubclass(obj, gl.contract.Contract)
        and obj is not gl.contract.Contract
    ]
    if len(contracts) != 1:
        print("FAIL: can dung 1 class ke thua gl.contract.Contract, tim thay "
              + str(len(contracts)))
        return 1
    cls = contracts[0]
    print("CONTRACT CLASS: " + cls.__name__)

    from genlayer._internal.get_schema import get_schema

    try:
        schema = get_schema(cls)
    except Exception as exc:
        print("SCHEMA: FAIL -> " + type(exc).__name__ + ": " + str(exc))
        traceback.print_exc()
        return 1

    methods = schema.get("methods", {})
    view = sum(1 for m in methods.values() if m.get("readonly"))
    print("SCHEMA: OK  methods=" + str(len(methods))
          + " (view=" + str(view) + ", write=" + str(len(methods) - view) + ")")
    print(json.dumps(sorted(methods), indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
