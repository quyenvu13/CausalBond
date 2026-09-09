"""The money path, executed on real GenVM.

RUNTIME_VERIFICATION.md proves the settlement once, live on StudioNet, with three
transaction hashes. That is the right evidence for the transfers themselves --
`_emit` goes out through `emit_transfer` on a `@gl.evm.contract_interface`, which
Direct Mode's wasi mock does not capture, so no local test can assert a transfer.

Everything up to the transfer is assertable, and none of it is covered by the six
tests currently in this directory: the deterministic breach predicate, the
per-edge carries vector, `_responsible_edge_from_vector`, the slash arithmetic,
the compensation total, and every bond being released to zero. This reproduces
the exact live scenario so it becomes a regression test rather than a one-off
observation.
"""
import json

from conftest import CONTRACT, GENVM_VERSION
import sys

import pytest

ANY_PROMPT = r".*CausalBond handoff check.*"
CARRIES = json.dumps({"decision": "CARRIES"})
DOES_NOT_CARRY = json.dumps({"decision": "DOES_NOT_CARRY"})


def addr(value) -> str:
    return "0x" + bytes(value).hex()


def chain_warp(vm, stamp: str) -> None:
    vm.warp(stamp)
    gl = sys.modules.get("genlayer.gl")
    if gl is not None and getattr(gl, "message_raw", None) is not None:
        gl.message_raw["datetime"] = stamp


def state(contract, case_id):
    return json.loads(contract.get_case(case_id))


# The two M0 clauses from the live run.
CLAUSES = json.dumps([
    {"kind": "REFUNDABLE_REQUIRED"},
    {"kind": "MAX_TOTAL_PRICE_USD", "value": 300},
])

# The live receipt: not refundable, so clause 0 breaks; 250 <= 300, so clause 1 holds.
RECEIPT = json.dumps({
    "refundable": False,
    "total_price_usd": 250,
    "cancellation_hours": 24,
    "checkin_unix": 1790000000,
})

BOND_PER_CLAUSE = 10_000_000_000_000_000      # 0.01 GEN
REQUIRED_BOND = BOND_PER_CLAUSE * 2           # 0.02 GEN, two clauses


def build_chain(direct_vm, direct_deploy, principal, prime, authority, child1, child2):
    """principal -> prime -> edge1(child1) -> edge2(child2), both edges accepted."""
    chain_warp(direct_vm, "2026-09-06T00:00:00Z")
    contract = direct_deploy(CONTRACT, sdk_version=GENVM_VERSION)

    direct_vm.sender = principal
    case_id = contract.create_mandate(
        "settlement-case", addr(prime), addr(authority), CLAUSES,
        BOND_PER_CLAUSE, 3600,
    )

    direct_vm.sender = prime
    direct_vm.value = REQUIRED_BOND
    try:
        contract.accept_prime_mandate(case_id)
    finally:
        direct_vm.value = 0

    # Edge 1 is carried by the prime's own bond; attaching value is refused.
    direct_vm.sender = prime
    e1 = contract.record_handoff(
        case_id, addr(child1),
        "Book a refundable hotel with total price no more than 300 USD.",
    )
    direct_vm.sender = child1
    contract.accept_handoff(case_id, e1)

    # Edge 2 drops the refundable requirement and posts its own bond.
    direct_vm.sender = child1
    direct_vm.value = REQUIRED_BOND
    try:
        e2 = contract.record_handoff(
            case_id, addr(child2),
            "Book any hotel with total price no more than 300 USD.",
        )
    finally:
        direct_vm.value = 0
    direct_vm.sender = child2
    contract.accept_handoff(case_id, e2)

    return contract, case_id, e1, e2


def test_the_live_settlement_reproduces_on_genvm(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie,
    direct_accounts,
):
    contract, case_id, e1, e2 = build_chain(
        direct_vm, direct_deploy,
        direct_alice, direct_bob, direct_charlie,
        direct_accounts[3], direct_accounts[4],
    )

    direct_vm.sender = direct_charlie
    contract.submit_receipt(case_id, RECEIPT)

    got = state(contract, case_id)
    assert got["breached_clause_indexes"] == [0], "only the refundable clause breaks"
    assert got["required_evaluations"] == 2, "one breached clause x two accepted edges"

    # M1 keeps the obligation; M2 drops it.
    direct_vm.clear_mocks()
    direct_vm.mock_llm(ANY_PROMPT, CARRIES)
    direct_vm.sender = direct_alice
    contract.evaluate_edge(case_id, 0, e1)

    direct_vm.clear_mocks()
    direct_vm.mock_llm(ANY_PROMPT, DOES_NOT_CARRY)
    contract.evaluate_edge(case_id, 0, e2)

    got = state(contract, case_id)
    assert got["evaluations"]["0:1"] == "CARRIES"
    assert got["evaluations"]["0:2"] == "DOES_NOT_CARRY"

    contract.finalize_dispute(case_id)
    got = state(contract, case_id)

    # Deterministic localisation: the obligation survives edge 1 and dies at edge 2.
    result = got["settlement"]["clause_results"][0]
    assert result["responsible_edge"] == 2
    assert result["liability"] == "EDGE_2"
    assert result["carries"] == [True, False]

    # One breached clause, one slash, charged to the edge that lost it.
    assert got["settlement"]["principal_compensation_wei"] == str(BOND_PER_CLAUSE)
    assert got["status"] == "SETTLED_BREACH"

    # Every bond released. Nothing may stay locked in the contract.
    assert got["prime_bond_locked"] == "0"
    for edge in got["edges"]:
        assert edge["bond_locked"] == "0", f"edge {edge['edge_index']} still holds bond"


def test_prime_is_liable_by_fallback_when_no_edge_dropped_the_obligation(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie,
    direct_accounts,
):
    """The case the design has to get right: the receipt shows a breach, but every
    recorded mandate still carried the obligation. Nobody in the chain dropped it,
    so responsibility falls back to the prime deterministically rather than being
    left unassigned."""
    contract, case_id, e1, e2 = build_chain(
        direct_vm, direct_deploy,
        direct_alice, direct_bob, direct_charlie,
        direct_accounts[3], direct_accounts[4],
    )

    direct_vm.sender = direct_charlie
    contract.submit_receipt(case_id, RECEIPT)

    direct_vm.clear_mocks()
    direct_vm.mock_llm(ANY_PROMPT, CARRIES)
    direct_vm.sender = direct_alice
    contract.evaluate_edge(case_id, 0, e1)
    contract.evaluate_edge(case_id, 0, e2)

    contract.finalize_dispute(case_id)
    got = state(contract, case_id)

    result = got["settlement"]["clause_results"][0]
    assert result["responsible_edge"] == 0
    assert result["liability"] == "PRIME_LIABLE"
    assert result["carries"] == [True, True]
    assert got["settlement"]["principal_compensation_wei"] == str(BOND_PER_CLAUSE)
    assert got["prime_bond_locked"] == "0"
    for edge in got["edges"]:
        assert edge["bond_locked"] == "0"
