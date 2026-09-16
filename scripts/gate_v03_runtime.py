#!/usr/bin/env python3
"""
Gate v0.3 cho CausalBond: nạp module, trích schema, CHẠY THẬT __init__ và các
đường deterministic trên storage in-memory của SDK py-genlayer v0.3.0-rc7.

Lý do tồn tại: gate schema không chạy __init__, nên không bắt được
    GenerationError: generic storage classes can not be instantiated with __init__
(`self.cases = TreeMap()` — hợp lệ ở v0.2, chết ở v0.3), lỗi chỉ lộ lúc deploy.

KHÔNG phủ: mọi thứ đi qua gl.vm.run_nondet / gl.nondet.exec_prompt, và
emit_transfer (cần GenVM thật).

  PYTHONPATH="<stub>:<sdk_src>" python3.13 scripts/gate_v03_runtime.py contracts/CausalBond.py
"""
import importlib.util
import json
import sys
import traceback

PRINCIPAL = "0x" + "11" * 20
PRIME = "0x" + "22" * 20
AUTHORITY = "0x" + "33" * 20
CHILD = "0x" + "44" * 20
STAMP = "2026-09-15T10:00:00Z"

_fail = []


def check(name, ok, detail=""):
    print(("  PASS  " if ok else "  FAIL  ") + name + ((" -> " + detail) if detail else ""))
    if not ok:
        _fail.append(name)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: gate_v03_runtime.py <contract.py>", file=sys.stderr)
        return 2

    spec = importlib.util.spec_from_file_location("contract_under_test", sys.argv[1])
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as exc:
        print("MODULE LOAD: FAIL -> " + type(exc).__name__ + ": " + str(exc))
        traceback.print_exc()
        return 1
    print("MODULE LOAD: OK")

    import genlayer as gl
    from genlayer.types import Address

    cls = [
        o for o in vars(module).values()
        if isinstance(o, type) and issubclass(o, gl.contract.Contract)
        and o is not gl.contract.Contract
    ][0]

    from genlayer._internal.get_schema import get_schema
    schema = get_schema(cls)
    print("SCHEMA: OK methods=" + str(len(schema["methods"])))

    # --- 1. constructor -----------------------------------------------------
    print("\n[1] constructor")
    try:
        c = gl.storage.inmem_allocate(cls)
        check("__init__ không raise", True)
    except Exception as exc:
        check("__init__ không raise", False, type(exc).__name__ + ": " + str(exc)[:200])
        traceback.print_exc()
        return 1
    check("storage TreeMap tự cấp phát", len(c.cases) == 0)
    check("case_count = 0", c.case_count == 0)

    # --- 2. đồng hồ tất định ------------------------------------------------
    print("\n[2] _now_unix — đồng hồ tất định từ gl.message.raw")
    import genlayer.message as msg
    msg.raw = {"datetime": STAMP, "sender_address": Address(PRINCIPAL)}
    msg.sender_address = Address(PRINCIPAL)
    msg.value = 0

    import calendar, datetime
    for stamp in [STAMP, "2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z",
                  "2024-02-29T12:00:00Z", "2000-03-01T00:00:00Z"]:
        msg.raw["datetime"] = stamp
        want = calendar.timegm(
            datetime.datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ").timetuple())
        got = c._now_unix()
        check("_now_unix " + stamp, got == want, str(got) + " vs " + str(want))
    msg.raw["datetime"] = STAMP

    check("hai lần gọi liên tiếp cho cùng giá trị", c._now_unix() == c._now_unix())

    # --- 3. create_mandate --------------------------------------------------
    print("\n[3] create_mandate (deterministic)")
    # CausalBond clauses: objects with a whitelisted kind, 2..4 of them.
    clauses = json.dumps([
        {"kind": "REFUNDABLE_REQUIRED"},
        {"kind": "MAX_TOTAL_PRICE_USD", "value": 2500},
        {"kind": "MIN_CANCELLATION_HOURS", "value": 48},
    ])
    try:
        case_id = c.create_mandate("CASE-1", PRIME, AUTHORITY, clauses, 1000, 86400)
        check("trả case_id", isinstance(case_id, str) and len(case_id) > 0, case_id[:22] + "…")
    except Exception as exc:
        check("trả case_id", False, type(exc).__name__ + ": " + str(exc)[:220])
        traceback.print_exc()
        return 1

    check("case_count = 1", c.case_count == 1)
    case = json.loads(c.get_case(case_id))
    check("principal = sender", case["principal"].lower() == PRINCIPAL.lower())
    check("prime_agent đúng", case["prime_agent"].lower() == PRIME.lower())
    check("receipt_authority đúng", case["receipt_authority"].lower() == AUTHORITY.lower())
    check("derive_case_id khớp", c.derive_case_id(PRINCIPAL, "CASE-1") == case_id)

    # --- 4. nhánh revert deterministic --------------------------------------
    print("\n[4] nhánh revert deterministic")

    def expect(name, fn, code):
        try:
            fn()
        except gl.vm.UserError as exc:
            got = str(getattr(exc, "data", exc))
            check(name, code in got, got[:110])
            return
        except Exception as exc:
            check(name, False, "sai loại: " + type(exc).__name__ + ": " + str(exc)[:110])
            return
        check(name, False, "không raise")

    expect("case_ref trùng",
           lambda: c.create_mandate("CASE-1", PRIME, AUTHORITY, clauses, 1000, 86400),
           "CASE_ALREADY_EXISTS")
    expect("case_ref rỗng",
           lambda: c.create_mandate("   ", PRIME, AUTHORITY, clauses, 1000, 86400),
           "CASE_REF_REQUIRED")
    expect("địa chỉ prime hỏng",
           lambda: c.create_mandate("CASE-2", "0xzz", AUTHORITY, clauses, 1000, 86400),
           "PRIME_AGENT")
    expect("clauses không phải JSON",
           lambda: c.create_mandate("CASE-3", PRIME, AUTHORITY, "{oops", 1000, 86400),
           "CLAUSES_JSON_INVALID")
    expect("clauses không phải array",
           lambda: c.create_mandate("CASE-4", PRIME, AUTHORITY, '{"a":1}', 1000, 86400),
           "CLAUSES_MUST_BE_ARRAY")
    expect("ít hơn MIN_CLAUSES",
           lambda: c.create_mandate("CASE-5", PRIME, AUTHORITY,
                                    '[{"kind":"REFUNDABLE_REQUIRED"}]', 1000, 86400),
           "CLAUSE_COUNT_OUT_OF_RANGE")
    expect("clause không phải object",
           lambda: c.create_mandate("CASE-6", PRIME, AUTHORITY, '["a","b"]', 1000, 86400),
           "CLAUSE_MUST_BE_OBJECT")
    expect("kind không nằm trong whitelist",
           lambda: c.create_mandate("CASE-7", PRIME, AUTHORITY,
               '[{"kind":"WHATEVER","value":1},{"kind":"MAX_TOTAL_PRICE_USD","value":5}]',
               1000, 86400),
           "CLAUSE_KIND_INVALID")
    expect("kind trùng nhau",
           lambda: c.create_mandate("CASE-8", PRIME, AUTHORITY,
               '[{"kind":"MAX_TOTAL_PRICE_USD","value":1},{"kind":"MAX_TOTAL_PRICE_USD","value":2}]',
               1000, 86400),
           "CLAUSE_KIND_DUPLICATE")
    expect("value là bool chứ không phải int",
           lambda: c.create_mandate("CASE-9", PRIME, AUTHORITY,
               '[{"kind":"REFUNDABLE_REQUIRED"},{"kind":"MAX_TOTAL_PRICE_USD","value":true}]',
               1000, 86400),
           "CLAUSE_VALUE_MUST_BE_INT")
    check("get_case id không tồn tại trả chuỗi rỗng, không raise",
          c.get_case("0" * 64) == "")

    # --- 5. kiểm soát vai trò ------------------------------------------------
    print("\n[5] kiểm soát vai trò")
    msg.sender_address = Address(CHILD)
    msg.raw["sender_address"] = Address(CHILD)
    expect("người lạ accept_prime_mandate",
           lambda: c.accept_prime_mandate(case_id), "ONLY_PRIME")
    expect("người lạ cancel_before_prime_acceptance",
           lambda: c.cancel_before_prime_acceptance(case_id), "ONLY_PRINCIPAL")

    print("\n" + "=" * 60)
    if _fail:
        print("GATE: FAIL (" + str(len(_fail)) + ")")
        for f in _fail:
            print("  - " + f)
        return 1
    print("GATE: ALL PASS")
    print("LƯU Ý: KHÔNG phủ nhánh semantic (gl.vm.run_nondet) và emit_transfer —")
    print("phải chứng minh trên GenVM / Studio thật.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
