/**
 * Regression gate — CB-UI-1.
 *
 * `.app-shell.is-pending button{pointer-events:none}` was written for the old
 * direct-write flow, where a pending transaction meant the page should stop
 * accepting input. Under Consensus v0.6 the signing gate renders INSIDE
 * `.app-shell`, and `setPending(true)` fires before the gate opens — so the rule
 * disabled the gate's own "Approve & sign" and "Cancel" buttons. Both were dead;
 * only a page reload escaped.
 *
 * This loads the real src/styles.css into a headless browser, rebuilds the exact
 * DOM nesting App.tsx produces, and clicks. No assertion about CSS text — it
 * measures whether the click lands.
 *
 * Run: node scripts/gate_pending_lock.mjs
 */
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('This gate needs Playwright, which is deliberately NOT a dependency of this');
  console.error('project — it would be installed on every Vercel build for no runtime benefit.');
  console.error('Install it once, locally:  npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');

const page_html = `<!doctype html><html><head><style>${css}</style></head><body>
<div class="app-shell route-create is-pending">
  <aside class="sidebar"><nav><button id="nav">nav</button></nav></aside>
  <main>
    <div class="txgate-backdrop"><div class="txgate-sheet">
      <div class="txgate-head"><button type="button" class="txgate-close" id="cancel">Cancel</button></div>
      <div class="gltk-root"><div class="gltk-panel"><div class="gltk-actions">
        <button type="button" class="gltk-hold" id="approve">Approve &amp; sign</button>
      </div></div></div>
    </div></div>
    <section class="panel"><button id="page">page button</button></section>
  </main>
</div>
<script>
  window.__hits = [];
  for (const id of ['approve','cancel','nav','page'])
    document.getElementById(id).addEventListener('click', () => window.__hits.push(id));
</script>
</body></html>`;

const CASES = [
  { id: 'approve', want: true,  why: 'gate: Approve & sign must stay clickable while pending' },
  { id: 'cancel',  want: true,  why: 'gate: Cancel must stay clickable while pending' },
  { id: 'nav',     want: false, why: 'page: sidebar nav must stay locked while pending' },
  { id: 'page',    want: false, why: 'page: form buttons must stay locked while pending' },
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(page_html);

let failed = 0;
for (const c of CASES) {
  await page.evaluate(() => { window.__hits = []; });
  try {
    await page.click('#' + c.id, { timeout: 1500 });
  } catch { /* pointer-events:none makes the element untargetable — that is a miss */ }
  const got = await page.evaluate(() => window.__hits.length > 0);
  const ok = got === c.want;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  #${c.id.padEnd(8)} click ${got ? 'landed' : 'blocked'} (want ${c.want ? 'landed' : 'blocked'})  — ${c.why}`);
}

await browser.close();
console.log(failed === 0 ? `\nCB-UI-1 gate: ${CASES.length}/${CASES.length} PASS` : `\nCB-UI-1 gate: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
