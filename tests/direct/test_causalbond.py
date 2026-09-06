import json
import sys
from datetime import datetime, timezone


def addr(value) -> str:
    return "0x" + bytes(value).hex()


def clauses() -> str:
    return json.dumps([
        {"kind": "REFUNDABLE_REQUIRED"},
        {"kind": "MAX_TOTAL_PRICE_USD", "value": 500},
    ])


def receipt(refundable=True, price=100) -> str:
    return json.dumps({
        "refundable": refundable,
        "total_price_usd": price,
        "cancellation_hours": 48,
        "checkin_unix": 1,
    })


def state(contract, case_id):
    return json.loads(contract.get_case(case_id))


def chain_warp(vm, stamp: str) -> None:
    """Work around genlayer-test 0.29.2 not refreshing gl.message_raw["datetime"]
    when VMContext.warp() is called. The contract itself only reads transaction
    datetime from gl.message_raw, so Direct Mode must refresh the same field.
    """
    vm.warp(stamp)
    gl = sys.modules.get("genlayer.gl")
    if gl is not None and getattr(gl, "message_raw", None) is not None:
        gl.message_raw["datetime"] = stamp


def test_transaction_datetime_is_persisted_deterministically(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    chain_warp(direct_vm, "2026-09-06T00:00:00Z")
    contract = direct_deploy("contracts/CausalBond.py")
    direct_vm.sender = direct_alice
    case_id = contract.create_mandate(
        "clock-case", addr(direct_bob), addr(direct_charlie), clauses(), 1000, 3600
    )
    got = state(contract, case_id)
    expected = int(datetime(2026, 9, 6, tzinfo=timezone.utc).timestamp())
    assert got["created_at_unix"] == expected
    assert got["execution_deadline_unix"] == expected + 3600


def test_receipt_authority_must_be_independent(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/CausalBond.py")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("RECEIPT_AUTHORITY_MUST_DIFFER_FROM_PRINCIPAL"):
        contract.create_mandate(
            "principal-auth", addr(direct_bob), addr(direct_alice), clauses(), 1000, 3600
        )
    with direct_vm.expect_revert("RECEIPT_AUTHORITY_MUST_DIFFER_FROM_PRIME"):
        contract.create_mandate(
            "prime-auth", addr(direct_bob), addr(direct_bob), clauses(), 1000, 3600
        )


def test_receipt_authority_cannot_become_chain_agent(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = direct_deploy("contracts/CausalBond.py")
    direct_vm.sender = direct_alice
    case_id = contract.create_mandate(
        "authority-chain", addr(direct_bob), addr(direct_charlie), clauses(), 1000, 3600
    )
    direct_vm.sender = direct_bob
    direct_vm.value = 2000
    contract.accept_prime_mandate(case_id)
    direct_vm.value = 0
    with direct_vm.expect_revert("RECEIPT_AUTHORITY_CANNOT_BE_CHAIN_AGENT"):
        contract.record_handoff(case_id, addr(direct_charlie), "Keep all original obligations.")


def test_pending_unsigned_handoff_cannot_block_receipt(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, direct_owner
):
    principal, prime, authority, child = direct_alice, direct_bob, direct_charlie, direct_owner
    contract = direct_deploy("contracts/CausalBond.py")
    direct_vm.sender = principal
    case_id = contract.create_mandate(
        "pending-receipt", addr(prime), addr(authority), clauses(), 1000, 3600
    )
    direct_vm.sender = prime
    direct_vm.value = 2000
    contract.accept_prime_mandate(case_id)
    direct_vm.value = 0
    contract.record_handoff(case_id, addr(child), "Keep all original obligations.")
    assert state(contract, case_id)["status"] == "HANDOFF_PENDING_ACCEPTANCE"

    direct_vm.sender = authority
    contract.submit_receipt(case_id, receipt())
    got = state(contract, case_id)
    assert got["status"] == "RECEIPT_NO_BREACH"
    assert got["pending_edge_index"] == 0
    assert got["required_evaluations"] == 0


def test_no_receipt_timeout_returns_bonds_without_breach_claim(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    chain_warp(direct_vm, "2026-09-06T00:00:00Z")
    contract = direct_deploy("contracts/CausalBond.py")
    direct_vm.sender = direct_alice
    case_id = contract.create_mandate(
        "no-receipt", addr(direct_bob), addr(direct_charlie), clauses(), 1000, 600
    )
    direct_vm.sender = direct_bob
    direct_vm.value = 2000
    contract.accept_prime_mandate(case_id)
    direct_vm.value = 0

    chain_warp(direct_vm, "2026-09-06T00:10:01Z")
    contract.close_after_execution_deadline(case_id)
    got = state(contract, case_id)
    assert got["status"] == "TIMED_OUT_NO_RECEIPT"
    assert got["settlement"]["type"] == "NO_RECEIPT_BONDS_RETURNED"
    assert int(got["settlement"]["principal_compensation_wei"]) == 0
    assert int(got["prime_bond_locked"]) == 0


def test_unsigned_trailing_edge_must_not_enter_the_carries_vector(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, direct_owner
):
    contract = direct_deploy("contracts/CausalBond.py")
    direct_vm.sender = direct_alice
    case_id = contract.create_mandate(
        "unsigned-vector", addr(direct_bob), addr(direct_charlie), clauses(), 1000, 3600
    )
    direct_vm.sender = direct_bob
    direct_vm.value = 2000
    contract.accept_prime_mandate(case_id)
    direct_vm.value = 0

    contract.record_handoff(case_id, addr(direct_owner), "All original obligations remain.")
    direct_vm.sender = direct_owner
    contract.accept_handoff(case_id, 1)

    direct_vm.value = 2000
    unsigned_child = "0x" + bytes([9] * 20).hex()
    contract.record_handoff(case_id, unsigned_child, "Onward, never signed.")
    direct_vm.value = 0

    direct_vm.sender = direct_charlie
    contract.submit_receipt(case_id, receipt(refundable=False, price=100))
    assert state(contract, case_id)["required_evaluations"] == 1

    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*CausalBond handoff check.*", json.dumps({"decision": "CARRIES"}))
    contract.evaluate_edge(case_id, 0, 1)
    direct_vm.run_validator()
    contract.finalize_dispute(case_id)

    got = state(contract, case_id)
    result = got["settlement"]["clause_results"][0]
    assert result["carries"] == [True]
    assert result["responsible_edge"] == 0
    assert result["liability"] == "PRIME_LIABLE"
    assert int(got["edges"][1]["bond_locked"]) == 0
    assert int(got["settlement"]["principal_compensation_wei"]) == 1000
