/**
 * Runtime evidence shown on the Verification page.
 *
 * The previous build hardcoded a case id and three transaction hashes from the
 * StudioNet deployment. On this deployment those records do not exist, so a
 * reader following them finds nothing — the page would be asserting a run that
 * never happened here. Nothing is hardcoded now: fill this in from the env only
 * after the settlement path has actually been executed against the deployed
 * contract, and paste the values that run produced.
 *
 * VITE_RUNTIME_EVIDENCE accepts JSON of the shape:
 * {
 *   "caseId": "…",
 *   "liability": "EDGE_2",
 *   "semanticCells": "2 / 2",
 *   "principalDelta": "+0.01 GEN",
 *   "contractBalance": "0 GEN",
 *   "transfers": [["PRINCIPAL SLASH", "0.01 GEN", "0x…"], …]
 * }
 */
export type RuntimeEvidence = {
  caseId: string;
  liability: string;
  semanticCells: string;
  principalDelta: string;
  contractBalance: string;
  transfers: [string, string, string][];
};

function parse(): RuntimeEvidence | null {
  const raw = import.meta.env.VITE_RUNTIME_EVIDENCE;
  if (!raw || raw.trim() === '') return null;
  try {
    const value = JSON.parse(raw) as RuntimeEvidence;
    if (!value?.caseId || !Array.isArray(value.transfers)) return null;
    return value;
  } catch {
    return null;
  }
}

export const RUNTIME_EVIDENCE = parse();
