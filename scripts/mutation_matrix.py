#!/usr/bin/env python3
"""Mutation checks for high-value CausalBond invariants."""
from __future__ import annotations
import os, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'contracts'/'CausalBond.py'
TEST=ROOT/'scripts'/'test_contract_logic.py'
AST=ROOT/'scripts'/'check_contract_ast.py'
FENCE=ROOT/'scripts'/'fence_probe.py'
source=SRC.read_text(encoding='utf-8')
mutations=[
('prime-role-bypass','        if gl.message.sender_address != Address(case["prime_agent"]):\n            raise gl.vm.UserError("ONLY_PRIME_AGENT")\n','        if False:\n            raise gl.vm.UserError("ONLY_PRIME_AGENT")\n'),
('principal-as-receipt-authority','        if receipt_authority == principal:\n            raise gl.vm.UserError("RECEIPT_AUTHORITY_MUST_DIFFER_FROM_PRINCIPAL")\n','        if False:\n            raise gl.vm.UserError("RECEIPT_AUTHORITY_MUST_DIFFER_FROM_PRINCIPAL")\n'),
('prime-as-receipt-authority','        if receipt_authority == prime:\n            raise gl.vm.UserError("RECEIPT_AUTHORITY_MUST_DIFFER_FROM_PRIME")\n','        if False:\n            raise gl.vm.UserError("RECEIPT_AUTHORITY_MUST_DIFFER_FROM_PRIME")\n'),
('authority-as-chain-agent','        if child == Address(case["receipt_authority"]):\n            raise gl.vm.UserError("RECEIPT_AUTHORITY_CANNOT_BE_CHAIN_AGENT")\n','        if False:\n            raise gl.vm.UserError("RECEIPT_AUTHORITY_CANNOT_BE_CHAIN_AGENT")\n'),
('receipt-authority-bypass','        if gl.message.sender_address != Address(case["receipt_authority"]):\n            raise gl.vm.UserError("ONLY_RECEIPT_AUTHORITY")\n','        if False:\n            raise gl.vm.UserError("ONLY_RECEIPT_AUTHORITY")\n'),
('current-executor-bypass','        if sender != Address(case["current_executor"]):\n            raise gl.vm.UserError("ONLY_CURRENT_EXECUTOR")\n','        if False:\n            raise gl.vm.UserError("ONLY_CURRENT_EXECUTOR")\n'),
('child-signature-bypass','        if gl.message.sender_address != Address(edge["child"]):\n            raise gl.vm.UserError("ONLY_DESIGNATED_CHILD")\n','        if False:\n            raise gl.vm.UserError("ONLY_DESIGNATED_CHILD")\n'),
('allow-cancel-after-prime','        if case["status"] != self.STATUS_AWAITING_PRIME:\n            raise gl.vm.UserError("CANNOT_CANCEL_AFTER_PRIME_ACCEPTANCE")\n','        if False:\n            raise gl.vm.UserError("CANNOT_CANCEL_AFTER_PRIME_ACCEPTANCE")\n'),
('allow-extra-first-edge-value','            if attached != 0:\n                raise gl.vm.UserError("FIRST_EDGE_USES_PRIME_BOND")\n','            if False:\n                raise gl.vm.UserError("FIRST_EDGE_USES_PRIME_BOND")\n'),
('allow-wrong-downstream-bond','            if attached != required:\n                raise gl.vm.UserError("POST_EXACT_REQUIRED_BOND")\n            bond_locked = required\n','            if False:\n                raise gl.vm.UserError("POST_EXACT_REQUIRED_BOND")\n            bond_locked = required\n'),
('remove-handoff-cap','        if len(edges) >= self.MAX_HANDOFFS:\n            raise gl.vm.UserError("MAX_HANDOFFS_REACHED")\n','        if False:\n            raise gl.vm.UserError("MAX_HANDOFFS_REACHED")\n'),
('allow-agent-reuse','            if edge.get("parent", "").lower() == child.as_hex.lower() or edge.get("child", "").lower() == child.as_hex.lower():\n                raise gl.vm.UserError("CHAIN_AGENT_REUSE_FORBIDDEN")\n','            if False:\n                raise gl.vm.UserError("CHAIN_AGENT_REUSE_FORBIDDEN")\n'),
('allow-principal-child','        if child == Address(case["principal"]):\n            raise gl.vm.UserError("PRINCIPAL_CANNOT_BE_CHILD")\n','        if False:\n            raise gl.vm.UserError("PRINCIPAL_CANNOT_BE_CHILD")\n'),
('pending-handoff-grief-reintroduced','        if case["status"] not in (self.STATUS_ACTIVE, self.STATUS_HANDOFF_PENDING):\n            raise gl.vm.UserError("CASE_NOT_READY_FOR_RECEIPT")\n','        if case["status"] != self.STATUS_ACTIVE:\n            raise gl.vm.UserError("CASE_NOT_READY_FOR_RECEIPT")\n'),
('allow-unbreached-evaluation','        if clause_index not in case.get("breached_clause_indexes", []):\n            raise gl.vm.UserError("CLAUSE_NOT_BREACHED")\n','        if False:\n            raise gl.vm.UserError("CLAUSE_NOT_BREACHED")\n'),
('allow-duplicate-evaluation','        if key in evaluations:\n            raise gl.vm.UserError("EVALUATION_ALREADY_RECORDED")\n','        if False:\n            raise gl.vm.UserError("EVALUATION_ALREADY_RECORDED")\n'),
('allow-incomplete-finalize','        if int(case.get("evaluation_count", 0)) != required:\n            raise gl.vm.UserError("EVALUATIONS_INCOMPLETE")\n','        if False:\n            raise gl.vm.UserError("EVALUATIONS_INCOMPLETE")\n'),
('include-unsigned-edge-in-finalize','        edges = [e for e in case.get("edges", []) if e.get("accepted") is True]\n','        edges = list(case.get("edges", []))\n'),
('close-bypasses-receipt','        if case["status"] in (self.STATUS_RECEIPT_NO_BREACH, self.STATUS_EVALUATING):\n            raise gl.vm.UserError("RECEIPT_ALREADY_SUBMITTED")\n','        if False:\n            raise gl.vm.UserError("RECEIPT_ALREADY_SUBMITTED")\n'),
('no-receipt-fabricates-liability','            "type": "NO_RECEIPT_BONDS_RETURNED",\n','            "type": "BROKEN_NO_RECEIPT_LIABILITY",\n'),
('fallback-becomes-edge1','        return 0\n\n    def _semantic_carries','        return 1\n\n    def _semantic_carries'),
('uncertainty-fails-open','- If uncertain, return DOES_NOT_CARRY.','- If uncertain, return CARRIES.'),
('external-outcome-semantic-creep','- Do not evaluate the booking outcome. The structured receipt is handled deterministically.','- Evaluate the booking outcome if useful.'),
]

caught=0
for name,old,new in mutations:
    count=source.count(old)
    if count!=1:
        print('FAIL fixture',name,'count',count); raise SystemExit(1)
    mutated=source.replace(old,new,1)
    with tempfile.TemporaryDirectory() as td:
        p=Path(td)/'CausalBond.py'; p.write_text(mutated,encoding='utf-8')
        env=dict(os.environ); env['CAUSALBOND_CONTRACT_PATH']=str(p)
        failed=''
        for gate,cmd in [
            ('core',['python',str(TEST)]),
            ('adversarial',['python',str(TEST),'--suite','adversarial']),
            ('ast',['python',str(AST)]),
            ('fence',['python',str(FENCE)]),
        ]:
            r=subprocess.run(cmd,cwd=str(ROOT),env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            if r.returncode!=0:
                failed=gate; break
    if failed:
        caught+=1; print('CAUGHT',name,'by',failed)
    else:
        print('MISSED',name)
print(f'Mutation matrix: {caught}/{len(mutations)} caught')
if caught!=len(mutations): raise SystemExit(1)
