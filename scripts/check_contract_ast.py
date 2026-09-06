#!/usr/bin/env python3
import ast, os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
path=Path(os.environ.get('CAUSALBOND_CONTRACT_PATH', ROOT/'contracts'/'CausalBond.py'))
text=path.read_text(encoding='utf-8')
mod=ast.parse(text)
classes={n.name:n for n in mod.body if isinstance(n,ast.ClassDef)}
assert 'CausalBond' in classes
c=classes['CausalBond']
methods={n.name:n for n in c.body if isinstance(n,ast.FunctionDef)}
required={
'create_mandate','accept_prime_mandate','cancel_before_prime_acceptance','record_handoff','accept_handoff',
'cancel_unaccepted_handoff','submit_receipt','evaluate_edge','settle_no_breach','finalize_dispute',
'force_prime_fallback_after_evaluation_timeout','close_after_execution_deadline','get_case'
}
missing=required-set(methods)
assert not missing, missing
assert 'gl.nondet.web' not in text, 'external web oracle forbidden'
assert 'time.time' not in text, 'validator-local wall clock forbidden'
assert '\nimport time\n' not in text, 'stdlib wall clock import forbidden'
assert 'RECEIPT_AUTHORITY_MUST_DIFFER_FROM_PRINCIPAL' in text
assert 'RECEIPT_AUTHORITY_MUST_DIFFER_FROM_PRIME' in text
assert 'RECEIPT_AUTHORITY_CANNOT_BE_CHAIN_AGENT' in text
assert 'NO_RECEIPT_BONDS_RETURNED' in text
assert 'prompt_comparative' not in text, 'semantic surface must stay one bounded per-edge question'
assert 'WIRE_CARRIES = "CARRIES"' in text and 'WIRE_DOES_NOT_CARRY = "DOES_NOT_CARRY"' in text
assert 'Compare this mandate only to the ORIGINAL OBLIGATION' in text
assert 'Do not identify a responsible agent or edge' in text
assert 'Do not evaluate the booking outcome' in text
assert 'If uncertain, return DOES_NOT_CARRY' in text
assert 'return 0' in text and '_responsible_edge_from_vector' in text
assert 'PRIME_LIABLE' in text
assert '@gl.public.write.payable\n    def accept_prime_mandate' in text
assert '@gl.public.write.payable\n    def record_handoff' in text
assert 'emit_transfer' in text
print('AST/POLICY: PASS')
