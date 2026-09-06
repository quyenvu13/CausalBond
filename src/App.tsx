import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_CONTRACT_ADDRESS, IS_DEPLOYED, STUDIONET_EXPLORER_URL } from './config';
import { connectWallet, readJson, readString, writeAndFinalize } from './genlayer';
import type { CaseState, Clause, ClauseKind, Edge } from './types';

type Route = 'overview' | 'create' | 'prime' | 'handoff' | 'receipt' | 'evaluate' | 'recovery' | 'inspect' | 'verification';

type WalletState = { account: `0x${string}`; client: any } | null;

const ZERO = '0x0000000000000000000000000000000000000000';

const clauseMeta: Record<ClauseKind, { label: string; unit?: string; placeholder?: string }> = {
  REFUNDABLE_REQUIRED: { label: 'Refundable required' },
  MAX_TOTAL_PRICE_USD: { label: 'Maximum total price', unit: 'USD', placeholder: '300' },
  MIN_CANCELLATION_HOURS: { label: 'Minimum free-cancellation window', unit: 'hours', placeholder: '24' },
  LATEST_CHECKIN_UNIX: { label: 'Latest check-in time', unit: 'Unix', placeholder: '1788134400' },
};

const routes: Array<{ id: Route; label: string; kicker: string }> = [
  { id: 'overview', label: 'Overview', kicker: 'Protocol' },
  { id: 'create', label: 'Create Mandate', kicker: '01' },
  { id: 'prime', label: 'Prime Bond', kicker: '02' },
  { id: 'handoff', label: 'Record Handoff', kicker: '03' },
  { id: 'receipt', label: 'Submit Receipt', kicker: '04' },
  { id: 'evaluate', label: 'Route Liability', kicker: '05' },
  { id: 'recovery', label: 'Recovery', kicker: '06' },
  { id: 'inspect', label: 'Inspect Chain', kicker: '07' },
  { id: 'verification', label: 'Verification', kicker: '08' },
];

function short(v?: string, n = 6) {
  if (!v) return '—';
  if (v.length <= n * 2 + 3) return v;
  return `${v.slice(0, n)}…${v.slice(-n)}`;
}

function prettyWei(v?: string | number | bigint) {
  if (v === undefined || v === null || v === '') return '0';
  try { return BigInt(v).toLocaleString('en-US'); } catch { return String(v); }
}

function requireFinalized(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Finalized-state postcondition failed: ${message}`);
}

function sameAddress(a?: string, b?: string) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

function weiEqual(a: unknown, b: unknown) {
  try { return BigInt(String(a ?? '0')) === BigInt(String(b ?? '0')); } catch { return false; }
}

function unixTime(v?: number) {
  if (!v) return '—';
  try { return new Date(v * 1000).toLocaleString(); } catch { return String(v); }
}

function renderClause(c: Clause) {
  switch (c.kind) {
    case 'REFUNDABLE_REQUIRED': return 'Booking must remain refundable';
    case 'MAX_TOTAL_PRICE_USD': return `Total price ≤ ${c.value} USD`;
    case 'MIN_CANCELLATION_HOURS': return `Free cancellation ≥ ${c.value} hours`;
    case 'LATEST_CHECKIN_UNIX': return `Check-in ≤ ${c.value}`;
  }
}

function StatusPill({ value }: { value?: string }) {
  return <span className={`status-pill ${String(value || '').toLowerCase()}`}>{value || 'NO CASE'}</span>;
}

function App() {
  const initial = (location.hash.replace('#/', '') || 'overview') as Route;
  const [route, setRoute] = useState<Route>(routes.some(r => r.id === initial) ? initial : 'overview');
  const [wallet, setWallet] = useState<WalletState>(null);
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [caseId, setCaseId] = useState('');
  const [caseState, setCaseState] = useState<CaseState | null>(null);

  useEffect(() => {
    const onHash = () => {
      const next = (location.hash.replace('#/', '') || 'overview') as Route;
      if (routes.some(r => r.id === next)) setRoute(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (next: Route) => {
    location.hash = `/${next}`;
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const connect = async () => {
    try {
      setPending(true); setNotice('');
      const w = await connectWallet();
      setWallet(w); setNotice('Wallet connected to StudioNet.');
    } catch (e: any) { setNotice(e?.message ?? String(e)); }
    finally { setPending(false); }
  };

  const loadCase = async (id = caseId) => {
    if (!IS_DEPLOYED) { setNotice('Set VITE_CONTRACT_ADDRESS after deployment before loading on-chain state.'); return null; }
    const clean = id.trim();
    if (!clean) { setNotice('Enter a case ID.'); return null; }
    try {
      setPending(true); setNotice('');
      const state = await readJson<CaseState>(DEFAULT_CONTRACT_ADDRESS, 'get_case', [clean]);
      if (!state) throw new Error('Case not found in finalized state.');
      setCaseId(clean); setCaseState(state); setNotice('Finalized case loaded.');
      return state;
    } catch (e: any) { setNotice(e?.message ?? String(e)); return null; }
    finally { setPending(false); }
  };

  const shellClass = `app-shell route-${route}`;

  return (
    <div className={shellClass}>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark"><span>CB</span></div>
          <div><strong>CausalBond</strong><small>BONDED DELEGATION ROUTING</small></div>
        </div>
        <div className="network-strip"><span className={IS_DEPLOYED ? 'dot live' : 'dot'} /> <b>STUDIONET</b><small>{IS_DEPLOYED ? short(DEFAULT_CONTRACT_ADDRESS, 7) : 'CONFIG REQUIRED'}</small></div>
        <nav>
          {routes.map(item => (
            <button key={item.id} className={route === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
              <span className="nav-kicker">{item.kicker}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>CORE RULE</span>
          <strong>Original M0 is the anchor.</strong>
          <p>Validators only answer CARRIES / DOES_NOT_CARRY. The contract routes liability.</p>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div className="topbar-left">
            <span className="chain-chip">GENLAYER · STUDIO</span>
            <span className="contract-chip">Contract {IS_DEPLOYED ? short(DEFAULT_CONTRACT_ADDRESS, 8) : 'not deployed'}</span>
          </div>
          <div className="topbar-actions">
            {IS_DEPLOYED && <a href={STUDIONET_EXPLORER_URL} target="_blank" rel="noreferrer">Explorer ↗</a>}
            <button className="wallet-button" onClick={connect} disabled={pending}>{wallet ? short(wallet.account, 7) : 'Connect wallet'}</button>
          </div>
        </header>

        {notice && <div className="notice"><span>●</span>{notice}{txHash && <small>tx {short(txHash, 10)}</small>}</div>}

        {route === 'overview' && <Overview onStart={() => navigate('create')} />}
        {route === 'create' && <CreateMandate wallet={wallet} setCaseId={setCaseId} setCaseState={setCaseState} setNotice={setNotice} setTxHash={setTxHash} setPending={setPending} navigate={navigate} />}
        {route === 'prime' && <PrimeBond wallet={wallet} caseId={caseId} setCaseId={setCaseId} caseState={caseState} loadCase={loadCase} setNotice={setNotice} setTxHash={setTxHash} setPending={setPending} />}
        {route === 'handoff' && <Handoff wallet={wallet} caseId={caseId} setCaseId={setCaseId} caseState={caseState} loadCase={loadCase} setNotice={setNotice} setTxHash={setTxHash} setPending={setPending} />}
        {route === 'receipt' && <Receipt wallet={wallet} caseId={caseId} setCaseId={setCaseId} caseState={caseState} loadCase={loadCase} setNotice={setNotice} setTxHash={setTxHash} setPending={setPending} />}
        {route === 'evaluate' && <Evaluate wallet={wallet} caseId={caseId} setCaseId={setCaseId} caseState={caseState} loadCase={loadCase} setNotice={setNotice} setTxHash={setTxHash} setPending={setPending} />}
        {route === 'recovery' && <Recovery wallet={wallet} caseId={caseId} setCaseId={setCaseId} caseState={caseState} loadCase={loadCase} setNotice={setNotice} setTxHash={setTxHash} setPending={setPending} />}
        {route === 'inspect' && <Inspect caseId={caseId} setCaseId={setCaseId} caseState={caseState} loadCase={loadCase} />}
        {route === 'verification' && <Verification />}
      </main>
    </div>
  );
}

function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <div className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{children}</p></div><div className="head-orbit"><i /><i /><i /></div></div>;
}

function Overview({ onStart }: { onStart: () => void }) {
  return <div className="page">
    <PageHead eyebrow="BONDED ACCOUNTABILITY FOR AGENT CHAINS" title="Responsibility should survive delegation.">
      CausalBond makes each delegator pre-post a bond, binds every handoff to a child-signed mandate, and routes money only after a structured receipt proves an original obligation was breached.
    </PageHead>
    <section className="hero-grid">
      <div className="hero-card primary-hero">
        <div className="hero-copy">
          <div className="hero-label">DELEGATE WORK · NOT RESPONSIBILITY</div>
          <h2>Accountability follows the mandate, not the messenger.</h2>
          <p>Every signed handoff stays anchored to original M0. Semantic checks stay binary; the contract handles attribution and moves the bond.</p>
          <button className="primary" onClick={onStart}>Create a bonded mandate <span>→</span></button>
        </div>
        <div className="delegation-orbit" aria-hidden="true">
          <div className="orbit-ring ring-a" />
          <div className="orbit-ring ring-b" />
          <div className="orbit-link link-a" />
          <div className="orbit-link link-b" />
          <div className="orbit-node node-origin"><b>M0</b><small>ORIGINAL</small></div>
          <div className="orbit-node node-mid"><b>M1</b><small>SIGNED</small></div>
          <div className="orbit-node node-route"><b>M2</b><small>ROUTE</small></div>
          <span className="orbit-caption">OBLIGATION CUSTODY</span>
        </div>
      </div>
      <div className="metric-card"><span>SEMANTIC SURFACE</span><strong>1 bit</strong><p>CARRIES / DOES_NOT_CARRY per obligation × edge.</p></div>
      <div className="metric-card"><span>CHAIN DEPTH</span><strong>≤ 3</strong><p>Fixed MVP depth keeps prompts bounded and reviewable.</p></div>
      <div className="metric-card"><span>CONSEQUENCE</span><strong>Bond → principal</strong><p>The contract computes the responsible edge and slashes that edge's posted bond.</p></div>
    </section>
    <section className="protocol-rail">
      <div><b>01</b><strong>Lock M0</strong><small>2–4 structured travel obligations</small></div>
      <span>→</span><div><b>02</b><strong>Bond + sign</strong><small>Parent posts; child accepts exact mandate</small></div>
      <span>→</span><div><b>03</b><strong>Receipt</strong><small>Designated authority supplies structured outcome</small></div>
      <span>→</span><div><b>04</b><strong>Route liability</strong><small>Boolean semantic checks + deterministic scan</small></div>
    </section>
    <section className="honest-scope">
      <span>HONEST SCOPE</span>
      <p>CausalBond adjudicates the on-chain mandate chain that participants signed and the structured receipt authenticated by the independent receipt authority. It does not independently prove what an agent actually executed in the external world. If both the prime and independent receipt authority remain silent, no receipt-confirmed breach exists and the protocol returns bonds rather than inventing liability.</p>
    </section>
  </div>;
}

function CreateMandate({ wallet, setCaseId, setCaseState, setNotice, setTxHash, setPending, navigate }: any) {
  const [caseRef, setCaseRef] = useState('');
  const [prime, setPrime] = useState('');
  const [receiptAuthority, setReceiptAuthority] = useState('');
  const [bondPer, setBondPer] = useState('');
  const [windowSeconds, setWindowSeconds] = useState('');
  const [selected, setSelected] = useState<ClauseKind[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});

  const toggle = (kind: ClauseKind) => setSelected(s => s.includes(kind) ? s.filter(x => x !== kind) : [...s, kind]);
  const clauses = useMemo(() => selected.map(kind => kind === 'REFUNDABLE_REQUIRED' ? { kind } : { kind, value: Number(values[kind]) }), [selected, values]);
  const valid = wallet && caseRef.trim() && prime.trim() && receiptAuthority.trim() && bondPer && windowSeconds && selected.length >= 2 && selected.length <= 4 && selected.every(k => k === 'REFUNDABLE_REQUIRED' || values[k]);

  const submit = async () => {
    if (!wallet || !IS_DEPLOYED || !valid) return;
    try {
      setPending(true); setNotice(''); setTxHash('');
      await writeAndFinalize(wallet.client, DEFAULT_CONTRACT_ADDRESS, 'create_mandate', [caseRef.trim(), prime.trim(), receiptAuthority.trim(), JSON.stringify(clauses), BigInt(bondPer), Number(windowSeconds)], 0n, setTxHash);
      const id = await readString(DEFAULT_CONTRACT_ADDRESS, 'derive_case_id', [wallet.account, caseRef.trim()]);
      const st = await readJson<CaseState>(DEFAULT_CONTRACT_ADDRESS, 'get_case', [id]);
      requireFinalized(st, 'created case is readable');
      requireFinalized(st.status === 'AWAITING_PRIME_ACCEPTANCE', 'created case must await prime acceptance');
      requireFinalized(sameAddress(st.principal, wallet.account), 'created case principal must be the connected wallet');
      requireFinalized(sameAddress(st.prime_agent, prime.trim()), 'created case prime must match the submitted prime');
      requireFinalized(sameAddress(st.receipt_authority, receiptAuthority.trim()), 'created case receipt authority must match the submitted authority');
      setCaseId(id); setCaseState(st); setNotice('Mandate created and verified in finalized state.'); navigate('prime');
    } catch (e: any) { setNotice(e?.message ?? String(e)); } finally { setPending(false); }
  };

  return <div className="page">
    <PageHead eyebrow="01 · IMMUTABLE M0" title="Create a bonded mandate">Define only machine-checkable travel obligations. Nothing is prefilled; this is a live creation surface, not a demo form.</PageHead>
    <div className="two-col">
      <section className="panel form-panel">
        <div className="panel-title"><span>MANDATE IDENTITY</span><b>M0</b></div>
        <label>Case reference<input value={caseRef} onChange={e => setCaseRef(e.target.value)} placeholder="Unique case reference" /></label>
        <div className="field-grid"><label>Prime agent<input value={prime} onChange={e => setPrime(e.target.value)} placeholder="0x…" /></label><label>Receipt authority<input value={receiptAuthority} onChange={e => setReceiptAuthority(e.target.value)} placeholder="0x…" /></label></div>
        <div className="field-grid"><label>Bond per clause (wei)<input inputMode="numeric" value={bondPer} onChange={e => setBondPer(e.target.value.replace(/\D/g, ''))} placeholder="Amount in wei" /></label><label>Execution window (seconds)<input inputMode="numeric" value={windowSeconds} onChange={e => setWindowSeconds(e.target.value.replace(/\D/g, ''))} placeholder="60 – 2592000" /></label></div>
        <div className="section-label">Select 2–4 original obligations</div>
        <div className="clause-builder">
          {(Object.keys(clauseMeta) as ClauseKind[]).map(kind => {
            const meta = clauseMeta[kind]; const on = selected.includes(kind);
            return <div key={kind} className={`clause-option ${on ? 'on' : ''}`}>
              <button type="button" className="toggle" onClick={() => toggle(kind)}><span>{on ? '✓' : '+'}</span>{meta.label}</button>
              {on && kind !== 'REFUNDABLE_REQUIRED' && <div className="clause-value"><input inputMode="numeric" value={values[kind] || ''} onChange={e => setValues(v => ({ ...v, [kind]: e.target.value.replace(/\D/g, '') }))} placeholder={meta.placeholder} /><small>{meta.unit}</small></div>}
            </div>;
          })}
        </div>
        <button className="primary wide" disabled={!valid || !IS_DEPLOYED} onClick={submit}>Create immutable M0</button>
      </section>
      <aside className="panel preview-panel"><div className="panel-title"><span>ORIGINAL OBLIGATIONS</span><b>{selected.length}/4</b></div>{selected.length === 0 ? <div className="empty-state">Choose obligations to build M0.</div> : <div className="obligation-list">{clauses.map((c: any, i) => <div key={i}><span>{String(i + 1).padStart(2, '0')}</span><strong>{renderClause({ kind: c.kind, value: c.value ?? true })}</strong></div>)}</div>}<div className="bond-readout"><span>Required bond per delegator</span><strong>{bondPer && selected.length ? prettyWei(BigInt(bondPer) * BigInt(selected.length)) : '—'} wei</strong><small>Every active liability source is funded for every original clause.</small></div></aside>
    </div>
  </div>;
}

function CaseLoader({ caseId, setCaseId, loadCase, caseState }: any) {
  return <div className="case-loader"><div><label>Case ID<input value={caseId} onChange={e => setCaseId(e.target.value)} placeholder="Paste a finalized case ID" /></label><button className="secondary" onClick={() => loadCase()}>Load finalized state</button></div>{caseState && <div className="loaded-case"><span>STATUS</span><StatusPill value={caseState.status} /><small>{caseState.case_ref} · executor {short(caseState.current_executor)}</small></div>}</div>;
}

function PrimeBond({ wallet, caseId, setCaseId, caseState, loadCase, setNotice, setTxHash, setPending }: any) {
  const accept = async () => {
    if (!wallet || !caseState || !IS_DEPLOYED) return;
    try {
      setPending(true); setNotice('');
      await writeAndFinalize(wallet.client, DEFAULT_CONTRACT_ADDRESS, 'accept_prime_mandate', [caseState.case_id], BigInt(caseState.required_bond_wei), setTxHash);
      const after = await loadCase(caseState.case_id);
      requireFinalized(after?.status === 'ACTIVE', 'prime acceptance must move the case to ACTIVE');
      requireFinalized(weiEqual(after?.prime_bond_locked, caseState.required_bond_wei), 'prime bond must equal the required bond');
      setNotice('Prime bond accepted and verified in finalized state.');
    } catch (e: any) { setNotice(e?.message ?? String(e)); } finally { setPending(false); }
  };
  return <div className="page"><PageHead eyebrow="02 · PRE-POSTED CONSEQUENCE" title="Prime accepts with a bond">The first liability source is funded before work starts. The bond is not chosen by validators and cannot be withdrawn after acceptance.</PageHead><CaseLoader {...{caseId,setCaseId,loadCase,caseState}} />{caseState && <section className="panel action-panel"><div className="bond-big"><span>REQUIRED PRIME BOND</span><strong>{prettyWei(caseState.required_bond_wei)} wei</strong><small>{caseState.clauses.length} clauses × {prettyWei(caseState.bond_per_clause_wei)} wei</small></div><div className="role-check"><span>Expected wallet</span><code>{caseState.prime_agent}</code><small>Connected: {wallet ? wallet.account : 'not connected'}</small></div>{caseState.status === 'AWAITING_PRIME_ACCEPTANCE' ? <button className="primary" onClick={accept} disabled={!wallet}>Accept mandate + lock bond</button> : <div className="action-complete"><span>✓</span><div><b>Prime mandate accepted</b><small>This action is closed in finalized state.</small></div></div>}</section>}</div>;
}

function Handoff({ wallet, caseId, setCaseId, caseState, loadCase, setNotice, setTxHash, setPending }: any) {
  const [child, setChild] = useState('');
  const [mandate, setMandate] = useState('');
  const [edgeInput, setEdgeInput] = useState('');
  const record = async () => {
    if (!wallet || !caseState || !child.trim() || !mandate.trim()) return;
    const next = caseState.edges.length + 1; const value = next === 1 ? 0n : BigInt(caseState.required_bond_wei);
    try {
      setPending(true);
      await writeAndFinalize(wallet.client, DEFAULT_CONTRACT_ADDRESS, 'record_handoff', [caseState.case_id, child.trim(), mandate.trim()], value, setTxHash);
      const after = await loadCase(caseState.case_id);
      const edge = after?.edges.find((e: any) => e.edge_index === next);
      requireFinalized(after?.status === 'HANDOFF_PENDING_ACCEPTANCE', 'recorded handoff must await child acceptance');
      requireFinalized(after?.pending_edge_index === next, 'pending edge index must match the new handoff');
      requireFinalized(edge && sameAddress(edge.child, child.trim()) && edge.accepted === false, 'new edge must bind the submitted child and remain unsigned');
      setChild(''); setMandate(''); setNotice(`Handoff edge ${next} recorded and verified; child signature required.`);
    } catch(e:any){setNotice(e?.message??String(e));} finally{setPending(false);}
  };
  const accept = async () => {
    if (!wallet || !caseState || !edgeInput) return;
    try {
      setPending(true);
      const target = Number(edgeInput);
      await writeAndFinalize(wallet.client, DEFAULT_CONTRACT_ADDRESS, 'accept_handoff', [caseState.case_id, target], 0n, setTxHash);
      const after = await loadCase(caseState.case_id);
      const edge = after?.edges.find((e: any) => e.edge_index === target);
      requireFinalized(after?.status === 'ACTIVE', 'accepted handoff must return the case to ACTIVE');
      requireFinalized(edge?.accepted === true && sameAddress(after?.current_executor, edge?.child), 'accepted child must become the current executor');
      setNotice('Child signature and executor transition verified in finalized state.');
    } catch(e:any){setNotice(e?.message??String(e));} finally{setPending(false);}
  };
  return <div className="page"><PageHead eyebrow="03 · SIGNED DELEGATION" title="Record one handoff at a time">The parent records the mandate; the designated child must sign that exact text before the chain advances.</PageHead><CaseLoader {...{caseId,setCaseId,loadCase,caseState}} />{caseState && <div className="two-col"><section className="panel form-panel"><div className="panel-title"><span>RECORD NEXT EDGE</span><b>{caseState.edges.length}/3</b></div><label>Child agent<input value={child} onChange={e=>setChild(e.target.value)} placeholder="0x…" /></label><label>Mandate text<textarea value={mandate} onChange={e=>setMandate(e.target.value)} placeholder="Write the exact mandate the child will receive and sign" maxLength={2400}/></label><div className="bond-note"><span>Bond source</span><strong>{caseState.edges.length === 0 ? 'Prime bond already locked' : `${prettyWei(caseState.required_bond_wei)} wei attached by parent`}</strong></div>{caseState.status === 'ACTIVE' && caseState.edges.length < 3 ? <button className="primary wide" onClick={record} disabled={!wallet || !child.trim() || !mandate.trim()}>Record handoff</button> : <div className="action-complete compact"><span>✓</span><div><b>Record action unavailable</b><small>State has advanced beyond this write surface.</small></div></div>}</section><section className="panel form-panel"><div className="panel-title"><span>CHILD SIGNATURE</span><b>ACCEPT</b></div><label>Pending edge index<input inputMode="numeric" value={edgeInput} onChange={e=>setEdgeInput(e.target.value.replace(/\D/g,''))} placeholder="1, 2, or 3" /></label><p className="instruction">Only the child address recorded on that edge can accept. Acceptance attests to the exact stored mandate text; it does not prove external execution.</p>{caseState.status === 'HANDOFF_PENDING_ACCEPTANCE' ? <button className="secondary wide" onClick={accept} disabled={!wallet || !edgeInput}>Sign accepted mandate</button> : <div className="action-complete compact"><span>✓</span><div><b>No signature pending</b><small>Accepted handoffs are read-only here.</small></div></div>}<ChainMini state={caseState}/></section></div>}</div>;
}

function ChainMini({ state }: { state: CaseState }) {
  return <div className="chain-mini"><div className="node prime"><span>M0</span><strong>{short(state.prime_agent)}</strong></div>{state.edges.map(e => <React.Fragment key={e.edge_index}><div className={`edge-line ${e.accepted ? 'signed' : 'pending'}`}><span>{e.accepted ? 'SIGNED' : 'PENDING'}</span></div><div className="node"><span>M{e.edge_index}</span><strong>{short(e.child)}</strong></div></React.Fragment>)}</div>;
}

function Receipt({ wallet, caseId, setCaseId, caseState, loadCase, setNotice, setTxHash, setPending }: any) {
  const [refundable, setRefundable] = useState('');
  const [price, setPrice] = useState(''); const [hours, setHours] = useState(''); const [checkin, setCheckin] = useState('');
  const valid = refundable !== '' && price && hours && checkin;
  const submit = async () => {
    if (!wallet || !caseState || !valid) return;
    const receipt={refundable: refundable==='true', total_price_usd:Number(price), cancellation_hours:Number(hours), checkin_unix:Number(checkin)};
    try{
      setPending(true);
      await writeAndFinalize(wallet.client,DEFAULT_CONTRACT_ADDRESS,'submit_receipt',[caseState.case_id,JSON.stringify(receipt)],0n,setTxHash);
      const after=await loadCase(caseState.case_id);
      requireFinalized(after && ['RECEIPT_NO_BREACH','EVALUATING_BREACH'].includes(after.status), 'receipt submission must commit a receipt state');
      requireFinalized(after?.receipt && typeof after.receipt.refundable === 'boolean', 'finalized receipt must be stored');
      setNotice('Structured receipt and deterministic breach set verified in finalized state.');
    }catch(e:any){setNotice(e?.message??String(e));}finally{setPending(false);}
  };
  return <div className="page"><PageHead eyebrow="04 · AUTHENTICATED OUTCOME INPUT" title="Submit a structured receipt">Only the independent receipt authority may submit. A recorded but unsigned final handoff cannot block receipt submission; only child-accepted edges enter semantic evaluation.</PageHead><CaseLoader {...{caseId,setCaseId,loadCase,caseState}} />{caseState && <div className="two-col"><section className="panel form-panel"><div className="panel-title"><span>TRAVEL RECEIPT</span><b>STRICT SCHEMA</b></div><label>Refundable<select value={refundable} onChange={e=>setRefundable(e.target.value)}><option value="">Choose…</option><option value="true">true</option><option value="false">false</option></select></label><div className="field-grid"><label>Total price (USD)<input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))} placeholder="Actual total price" /></label><label>Cancellation hours<input inputMode="numeric" value={hours} onChange={e=>setHours(e.target.value.replace(/\D/g,''))} placeholder="Actual free-cancellation hours" /></label></div><label>Check-in Unix timestamp<input inputMode="numeric" value={checkin} onChange={e=>setCheckin(e.target.value.replace(/\D/g,''))} placeholder="Actual check-in timestamp" /></label>{['ACTIVE','HANDOFF_PENDING_ACCEPTANCE'].includes(caseState.status) ? <button className="primary wide" disabled={!wallet || !valid} onClick={submit}>Commit receipt</button> : caseState.receipt ? <div className="action-complete"><span>✓</span><div><b>Receipt committed</b><small>Finalized receipt is now read-only.</small></div></div> : null}</section><aside className="panel preview-panel"><div className="panel-title"><span>RECEIPT AUTHORITY</span><b>PROVENANCE</b></div><code className="address-block">{caseState.receipt_authority}</code><p className="instruction">CausalBond authenticates who submitted this structured receipt. It does not independently attest the off-chain booking itself.</p><div className="deadline"><span>Execution deadline</span><strong>{unixTime(caseState.execution_deadline_unix)}</strong></div></aside></div>}</div>;
}

function Evaluate({ wallet, caseId, setCaseId, caseState, loadCase, setNotice, setTxHash, setPending }: any) {
  const [clauseIndex, setClauseIndex] = useState(''); const [edgeIndex, setEdgeIndex] = useState('');
  const evaluate = async () => {
    if (!wallet || !caseState || clauseIndex==='' || !edgeIndex) return;
    try{
      setPending(true);
      const ci=Number(clauseIndex), ei=Number(edgeIndex), before=caseState.evaluation_count;
      requireFinalized(!caseState.evaluations?.[`${ci}:${ei}`], 'selected matrix cell must be unevaluated before submission');
      await writeAndFinalize(wallet.client,DEFAULT_CONTRACT_ADDRESS,'evaluate_edge',[caseState.case_id,ci,ei],0n,setTxHash);
      const after=await loadCase(caseState.case_id);
      const decision=after?.evaluations?.[`${ci}:${ei}`];
      requireFinalized(decision==='CARRIES' || decision==='DOES_NOT_CARRY', 'evaluated matrix cell must exist in finalized state');
      requireFinalized(after?.evaluation_count===before+1, 'evaluation count must increment exactly once');
      setNotice('One bounded semantic cell verified in finalized state.');
    }catch(e:any){setNotice(e?.message??String(e));}finally{setPending(false);}
  };
  const finalize = async () => {
    if(!wallet||!caseState)return;
    try{
      setPending(true);
      await writeAndFinalize(wallet.client,DEFAULT_CONTRACT_ADDRESS,'finalize_dispute',[caseState.case_id],0n,setTxHash);
      const after=await loadCase(caseState.case_id);
      requireFinalized(after?.status==='SETTLED_BREACH' && after?.settlement?.type==='BREACH_SETTLED', 'breach settlement must be terminal and recorded');
      requireFinalized(weiEqual(after?.prime_bond_locked,0) && (after?.edges||[]).every((e:any)=>weiEqual(e.bond_locked,0)), 'all settled bond balances must be zero');
      setNotice('Liability routing and bond settlement verified in finalized state.');
    }catch(e:any){setNotice(e?.message??String(e));}finally{setPending(false);}
  };
  const settleNoBreach=async()=>{
    if(!wallet||!caseState)return;
    try{
      setPending(true);
      await writeAndFinalize(wallet.client,DEFAULT_CONTRACT_ADDRESS,'settle_no_breach',[caseState.case_id],0n,setTxHash);
      const after=await loadCase(caseState.case_id);
      requireFinalized(after?.status==='SETTLED_SUCCESS' && after?.settlement?.type==='NO_BREACH', 'no-breach settlement must be terminal and recorded');
      requireFinalized(weiEqual(after?.prime_bond_locked,0) && (after?.edges||[]).every((e:any)=>weiEqual(e.bond_locked,0)), 'all released bond balances must be zero');
      setNotice('No-breach bond release verified in finalized state.');
    }catch(e:any){setNotice(e?.message??String(e));}finally{setPending(false);}
  };
  return <div className="page"><PageHead eyebrow="05 · DETERMINISTIC ATTRIBUTION" title="Route liability from a boolean matrix">Every semantic call asks about one original obligation and one signed mandate. Once the matrix is complete, the contract scans it and moves money.</PageHead><CaseLoader {...{caseId,setCaseId,loadCase,caseState}} />{caseState && <><LiabilityMatrix state={caseState}/><section className="panel evaluate-actions"><div><span>PROGRESS</span><strong>{caseState.evaluation_count}/{caseState.required_evaluations}</strong><small>{caseState.breached_clause_indexes.length} breached clause(s)</small></div>{caseState.status==='EVALUATING_BREACH' && <div className="inline-actions"><select value={clauseIndex} onChange={e=>setClauseIndex(e.target.value)}><option value="">Breached clause…</option>{caseState.breached_clause_indexes.map((i: number)=><option key={i} value={i}>Clause {i+1}</option>)}</select><select value={edgeIndex} onChange={e=>setEdgeIndex(e.target.value)}><option value="">Edge…</option>{caseState.edges.filter((e: Edge)=>e.accepted).map((e: Edge)=><option key={e.edge_index} value={e.edge_index}>M{e.edge_index}</option>)}</select><button className="secondary" onClick={evaluate} disabled={!wallet || clauseIndex==='' || !edgeIndex}>Evaluate cell</button><button className="primary" onClick={finalize} disabled={!wallet || caseState.evaluation_count!==caseState.required_evaluations}>Finalize routing</button></div>}{caseState.status==='RECEIPT_NO_BREACH' && <button className="primary" disabled={!wallet} onClick={settleNoBreach}>Release all bonds</button>}</section></>}</div>;
}


function Recovery({ wallet, caseId, setCaseId, caseState, loadCase, setNotice, setTxHash, setPending }: any) {
  const run = async (method: string, args: unknown[], verify: (after: CaseState | null) => void, success: string) => {
    if (!wallet || !caseState) return;
    try {
      setPending(true); setNotice('');
      await writeAndFinalize(wallet.client, DEFAULT_CONTRACT_ADDRESS, method, args, 0n, setTxHash);
      const after = await loadCase(caseState.case_id);
      verify(after);
      setNotice(success);
    } catch (e: any) { setNotice(e?.message ?? String(e)); } finally { setPending(false); }
  };

  const cancelBeforePrime = () => run(
    'cancel_before_prime_acceptance', [caseState?.case_id],
    after => requireFinalized(after?.status === 'CANCELLED_BEFORE_PRIME_ACCEPTANCE', 'pre-prime cancellation must be terminal'),
    'Pre-prime cancellation verified in finalized state.'
  );

  const cancelPending = () => {
    if (!caseState?.pending_edge_index) return;
    const target = caseState.pending_edge_index;
    const beforeLen = caseState.edges.length;
    run(
      'cancel_unaccepted_handoff', [caseState.case_id, target],
      after => {
        requireFinalized(after?.status === 'ACTIVE', 'expired unsigned handoff cancellation must restore ACTIVE');
        requireFinalized(after?.pending_edge_index === 0, 'pending edge must be cleared');
        requireFinalized(after?.edges.length === beforeLen - 1 && !after?.edges.some(e => e.edge_index === target), 'unsigned edge must be removed');
      },
      'Expired unsigned handoff cancellation verified in finalized state.'
    );
  };

  const forceFallback = () => run(
    'force_prime_fallback_after_evaluation_timeout', [caseState?.case_id],
    after => {
      requireFinalized(after?.status === 'SETTLED_BREACH' && after?.settlement?.type === 'EVALUATION_TIMEOUT_PRIME_FALLBACK', 'evaluation timeout must settle through prime fallback');
      requireFinalized(weiEqual(after?.prime_bond_locked, 0) && (after?.edges || []).every(e => weiEqual(e.bond_locked, 0)), 'fallback settlement must zero all bond balances');
    },
    'Evaluation-timeout prime fallback verified in finalized state.'
  );

  const closeNoReceipt = () => run(
    'close_after_execution_deadline', [caseState?.case_id],
    after => {
      requireFinalized(!!after && ['TIMED_OUT_NO_RECEIPT', 'EXPIRED_UNACCEPTED'].includes(after.status), 'execution-deadline close must reach a no-receipt terminal state');
      if (after?.status === 'TIMED_OUT_NO_RECEIPT') {
        requireFinalized(after.settlement?.type === 'NO_RECEIPT_BONDS_RETURNED', 'no-receipt close must record bond return');
        requireFinalized(weiEqual(after.prime_bond_locked, 0) && (after.edges || []).every(e => weiEqual(e.bond_locked, 0)), 'no-receipt close must release all locked bonds');
      }
    },
    'Execution-deadline close verified in finalized state.'
  );

  const pendingEdge = caseState?.edges.find((e: any) => e.edge_index === caseState?.pending_edge_index);
  return <div className="page">
    <PageHead eyebrow="06 · LIVENESS & EXIT PATHS" title="Recover funds without bypassing liability">These are the contract's timeout and cancellation paths. They never erase a receipt-confirmed consequence, and every browser success is rechecked against finalized state.</PageHead>
    <CaseLoader {...{caseId,setCaseId,loadCase,caseState}} />
    {caseState && <section className="recovery-grid">
      <div className="panel recovery-card"><span>BEFORE PRIME ACCEPTANCE</span><h3>Cancel an unbonded mandate</h3><p>Principal-only. Available only before the prime accepts and posts its bond.</p><button className="secondary wide" disabled={!wallet || caseState.status !== 'AWAITING_PRIME_ACCEPTANCE'} onClick={cancelBeforePrime}>Cancel before prime acceptance</button></div>
      <div className="panel recovery-card"><span>UNSIGNED HANDOFF</span><h3>Release an expired pending edge</h3><p>The recorded edge never became part of the signed chain. Its parent can cancel only after the acceptance deadline.</p><small>{pendingEdge ? `Pending edge ${pendingEdge.edge_index} · deadline ${unixTime(pendingEdge.acceptance_deadline_unix)}` : 'No pending edge loaded.'}</small><button className="secondary wide" disabled={!wallet || caseState.status !== 'HANDOFF_PENDING_ACCEPTANCE' || !caseState.pending_edge_index} onClick={cancelPending}>Cancel expired unsigned handoff</button></div>
      <div className="panel recovery-card"><span>EVALUATION TIMEOUT</span><h3>Force prime-liable fallback</h3><p>A breach receipt already exists. If consensus cannot finish, the contract preserves the consequence and routes breached clauses to prime liability.</p><small>Deadline {unixTime(caseState.evaluation_deadline_unix)}</small><button className="primary wide" disabled={!wallet || caseState.status !== 'EVALUATING_BREACH'} onClick={forceFallback}>Force fallback after deadline</button></div>
      <div className="panel recovery-card"><span>NO RECEIPT</span><h3>Close after execution deadline</h3><p>No authenticated receipt means no deterministic breach predicate. The protocol returns locked bonds instead of inventing liability.</p><small>Deadline {unixTime(caseState.execution_deadline_unix)}</small><button className="secondary wide" disabled={!wallet || ['RECEIPT_NO_BREACH','EVALUATING_BREACH','SETTLED_SUCCESS','SETTLED_BREACH','TIMED_OUT_NO_RECEIPT','EXPIRED_UNACCEPTED','CANCELLED_BEFORE_PRIME_ACCEPTANCE'].includes(caseState.status)} onClick={closeNoReceipt}>Close expired no-receipt case</button></div>
    </section>}
  </div>;
}

function LiabilityMatrix({ state }: { state: CaseState }) {
  const results = state.settlement?.clause_results || [];
  return <section className="panel matrix-panel"><div className="matrix-head"><div><span>OBLIGATION ROUTING MATRIX</span><h3>Every column is compared to M0</h3></div><StatusPill value={state.status}/></div><div className="matrix-scroll"><table><thead><tr><th>Original obligation</th><th className="m0">M0 · ORIGINAL</th>{[1,2,3].map(i=><th key={i}>M{i} · HANDOFF</th>)}<th>Liability</th></tr></thead><tbody>{state.clauses.map((clause, ci)=>{const result=results.find(r=>r.clause_index===ci);const breached=state.breached_clause_indexes.includes(ci);return <tr key={ci} className={breached?'breached':''}><td><span className="row-num">{String(ci+1).padStart(2,'0')}</span><strong>{renderClause(clause)}</strong><small>{breached?'RECEIPT BREACH':'receipt satisfied'}</small></td><td className="cell original"><b>LOCKED</b></td>{[1,2,3].map(ei=>{const edge=state.edges.find(e=>e.edge_index===ei);if(!edge)return <td key={ei} className="cell empty">—</td>;const decision=state.evaluations?.[`${ci}:${ei}`];const cls=decision==='CARRIES'?'carry':decision==='DOES_NOT_CARRY'?'drop':edge.accepted?'signed':'pending';return <td key={ei} className={`cell ${cls}`}><b>{decision || (edge.accepted?'SIGNED':'PENDING')}</b><small>{short(edge.child)}</small></td>;})}<td className="liability-cell"><strong>{result?.liability || (breached?'PENDING':'—')}</strong></td></tr>;})}</tbody></table></div></section>;
}

function Inspect({ caseId, setCaseId, caseState, loadCase }: any) {
  return <div className="page"><PageHead eyebrow="07 · FINALIZED STATE" title="Inspect the recorded chain">Load any finalized case. Action forms stay empty by default; inspection is where historical state belongs.</PageHead><CaseLoader {...{caseId,setCaseId,loadCase,caseState}} />{caseState && <><section className="case-facts"><div><span>PRINCIPAL</span><strong>{short(caseState.principal,9)}</strong></div><div><span>PRIME</span><strong>{short(caseState.prime_agent,9)}</strong></div><div><span>RECEIPT AUTHORITY</span><strong>{short(caseState.receipt_authority,9)}</strong></div><div><span>BOND / CLAUSE</span><strong>{prettyWei(caseState.bond_per_clause_wei)} wei</strong></div></section><LiabilityMatrix state={caseState}/><section className="panel raw-chain"><div className="panel-title"><span>SIGNED HANDOFFS</span><b>{caseState.edges.length}/3</b></div>{caseState.edges.length===0?<div className="empty-state">No delegation edges recorded.</div>:caseState.edges.map((e: Edge)=><div className="edge-record" key={e.edge_index}><span>EDGE {e.edge_index}</span><div><b>{short(e.parent,9)} → {short(e.child,9)}</b><small>{e.accepted?'child-signed':'awaiting signature'} · bond {prettyWei(e.bond_locked)} wei</small></div><p>{e.mandate_text}</p></div>)}</section></>}</div>;
}

function Verification() {
  const runtimeCase = '97d8b5c551db611fe26559622798849f1394f2019249e01e75dfe3f431b3a04f';
  const transfers = [
    ['PRINCIPAL SLASH', '0.01 GEN', '0x36f7ce0e91c0adc717e1cf21632941b34a3b087f164d68aaf5d34682ac2b54e9'],
    ['PRIME REFUND', '0.02 GEN', '0xcf4c01a145b45c6ac2afe040d9814dc3412240d84de565fe9e7b7b6d981e7277'],
    ['EDGE-2 REFUND', '0.01 GEN', '0xebc5c4e34c86f8f9974a0360fdc6fdbd049645f5544154a47f5e658c5fd8aa3c'],
  ];
  return <div className="page">
    <PageHead eyebrow="08 · EXECUTED EVIDENCE" title="StudioNet verification">The primary bonded-delegation path was executed against the deployed contract. Runtime references live here, never inside transaction forms.</PageHead>
    <section className="verification-empty">
      <div className="verify-icon">✓</div>
      <h2>Targeted native settlement verified</h2>
      <p>Runtime case <code>{short(runtimeCase, 12)}</code> produced M1 = CARRIES, M2 = DOES_NOT_CARRY, deterministic EDGE_2 liability, and three finalized native GEN transfers. The contract balance returned to 0 GEN.</p>
      <div className="verify-grid">
        <div><span>LIABILITY</span><strong>EDGE_2</strong></div>
        <div><span>SEMANTIC CELLS</span><strong>2 / 2</strong></div>
        <div><span>PRINCIPAL</span><strong>+0.01 GEN</strong></div>
        <div><span>CONTRACT BALANCE</span><strong>0 GEN</strong></div>
      </div>
      <div className="runtime-proof-list">
        {transfers.map(([label, value, hash]) => <div key={hash}><span>{label}</span><strong>{value}</strong><code>{short(hash, 12)}</code></div>)}
      </div>
      <a className="proof-link" href={STUDIONET_EXPLORER_URL} target="_blank" rel="noreferrer">Open deployed contract on Explorer ↗</a>
    </section>
  </div>;
}

export default App;
