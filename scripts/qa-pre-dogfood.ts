// ════════════════════════════════════════════════════════════════════════
// scripts/qa-pre-dogfood.ts — Pre-dogfood E2E smoke check.
//
// Replays the three flows that, if broken, would discover themselves
// at the worst moment (mid-deadline, real client data on the line):
//
//   1. Document upload  → AI extraction (Haiku) → deterministic
//      classifier → invoice_lines with treatments.
//   2. AED letter upload → AI reader (Haiku) tags type/urgency/deadline.
//   3. Tax-Ops rollover preview + commit — the once-a-year bulk creation
//      of next year's filings (idempotent ON CONFLICT DO NOTHING).
//
// Usage:
//   1. Start the dev server in a separate terminal: `npm run dev`
//   2. Run this:                                    `npx tsx scripts/qa-pre-dogfood.ts`
//
// The script asks for ADMIN_PASSWORD via env var (set in .env.local), logs in,
// and runs each flow against http://localhost:3000. Output is a per-flow
// PASS/FAIL summary. Exits 1 if any flow fails.
//
// Ran first on 2026-05-06 — exposed the rollover commit RangeError caused
// by adhoc_no_deadline rules returning '' as effective deadline, which the
// pg driver tried to coerce to a Date. Fixed in the same commit.
//
// Cost: ~3-5 Anthropic Haiku calls, ~€0.05.
// ════════════════════════════════════════════════════════════════════════

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const HOST = process.env.QA_HOST ?? 'http://localhost:3000';
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!PASSWORD) {
  console.error('ADMIN_PASSWORD env var required (set in .env.local + sourced).');
  process.exit(2);
}

const FIXTURES_DIR = '/tmp/cifra-test-invoices';
const REQUIRED_FIXTURES = [
  '01-arendt-medernach-legal-fees.pdf',     // → LUX_17
  '04-bil-banking-fees.pdf',                // → EXEMPT_44A_FIN
  '05-microsoft-ireland-office365.pdf',     // → RC_EU_TAX
];

if (!REQUIRED_FIXTURES.every(f => existsSync(`${FIXTURES_DIR}/${f}`))) {
  console.error(`Fixtures missing in ${FIXTURES_DIR}. Run: npx tsx scripts/gen-test-invoices.ts`);
  process.exit(2);
}

let cookie = '';
let failures = 0;

function pass(name: string, detail?: string) {
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name: string, detail: string) {
  console.log(`  ❌ ${name} — ${detail}`);
  failures += 1;
}

async function login() {
  const res = await fetch(`${HOST}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = /cifra_auth=([^;]+)/.exec(setCookie);
  if (!match) throw new Error(`login failed: ${res.status}`);
  cookie = `cifra_auth=${match[1]}`;
}

function authHeaders() {
  return { Cookie: cookie };
}

// ─── Flow 1: extract + classify ─────────────────────────────────────

async function flow1Extract() {
  console.log('\n[1/3] Document upload → AI extraction → classifier');

  const declRes = await fetch(`${HOST}/api/declarations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ entity_id: 'demo-ent-scsp', year: 2099, period: 'Q4' }),
  });
  if (!declRes.ok && declRes.status !== 409) {
    fail('create declaration', `${declRes.status}`);
    return;
  }
  // 409 = already exists from a prior run; fetch its id
  let declarationId: string;
  if (declRes.status === 409) {
    const list = await fetch(`${HOST}/api/declarations`, { headers: authHeaders() }).then(r => r.json());
    const existing = list.find((d: { entity_id: string; year: number; period: string }) =>
      d.entity_id === 'demo-ent-scsp' && d.year === 2099 && d.period === 'Q4');
    if (!existing) { fail('lookup existing declaration', 'not found in list'); return; }
    declarationId = existing.id;
  } else {
    declarationId = (await declRes.json()).id;
  }
  pass('declaration ready', declarationId.slice(0, 8));

  // Upload via curl (Bun/Node fetch + FormData with file is awkward)
  const uploadCmd = [
    `curl -sS -X POST -b "${cookie}"`,
    `-F "declaration_id=${declarationId}"`,
    ...REQUIRED_FIXTURES.map(f => `-F "files=@${FIXTURES_DIR}/${f}"`),
    `${HOST}/api/documents/upload`,
  ].join(' ');
  const uploadRaw = execSync(uploadCmd).toString();
  const upload = JSON.parse(uploadRaw);
  if (upload.count !== REQUIRED_FIXTURES.length) {
    fail('upload', `expected ${REQUIRED_FIXTURES.length} docs, got ${upload.count}`);
    return;
  }
  pass('uploaded', `${upload.count} docs`);

  const extractRes = await fetch(`${HOST}/api/agents/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ declaration_id: declarationId }),
  });
  const extractBody = await extractRes.json();
  if (!extractRes.ok || !extractBody.job_id) {
    fail('extract trigger', `${extractRes.status}: ${JSON.stringify(extractBody).slice(0, 100)}`);
    return;
  }
  const jobId = extractBody.job_id;
  pass('extract job started', jobId.slice(0, 8));

  // Poll
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const job = await fetch(`${HOST}/api/jobs/${jobId}`, { headers: authHeaders() }).then(r => r.json());
    if (job.status === 'done') {
      const msg = JSON.parse(job.message ?? '{}');
      const cls = msg.classification ?? {};
      if (msg.extracted < REQUIRED_FIXTURES.length) {
        fail('extract result', `extracted ${msg.extracted}/${REQUIRED_FIXTURES.length}`);
      } else {
        pass('extracted', `${msg.extracted}/${REQUIRED_FIXTURES.length}`);
      }
      if (cls.classified === undefined || cls.classified < cls.processed) {
        fail('classifier', `classified ${cls.classified}/${cls.processed}`);
      } else {
        pass('classified', `${cls.classified}/${cls.processed} via ${Object.keys(cls.by_rule ?? {}).join(', ')}`);
      }
      return;
    }
    if (job.status === 'failed') {
      fail('extract job', `failed: ${job.error_message}`);
      return;
    }
  }
  fail('extract job', 'timed out after 60s');
}

// ─── Flow 2: AED letter upload + AI reader ──────────────────────────

async function flow2Aed() {
  console.log('\n[2/3] AED letter upload → AI reader');

  const cmd = [
    `curl -sS -X POST -b "${cookie}"`,
    `-F "file=@${FIXTURES_DIR}/01-arendt-medernach-legal-fees.pdf"`,
    `${HOST}/api/aed/upload`,
  ].join(' ');
  let result;
  try {
    result = JSON.parse(execSync(cmd, { timeout: 90000 }).toString());
  } catch (err) {
    fail('aed upload', String(err).slice(0, 100));
    return;
  }
  if (!result.success || !result.id) {
    fail('aed upload', JSON.stringify(result).slice(0, 100));
    return;
  }
  pass('upload', result.id.slice(0, 8));

  const list = await fetch(`${HOST}/api/aed`, { headers: authHeaders() }).then(r => r.json());
  const item = list.find((d: { id: string }) => d.id === result.id);
  if (!item) {
    fail('aed listing', 'item not in /api/aed list');
    return;
  }
  if (!item.summary) {
    fail('ai reader', 'no summary extracted');
    return;
  }
  pass('ai reader', `type=${item.type}, urgency=${item.urgency}`);
}

// ─── Flow 3: Tax-Ops rollover preview + commit (idempotent) ─────────

async function flow3Rollover() {
  console.log('\n[3/3] Tax-Ops rollover (preview + commit)');

  // Use a future "QA" year (2099) so it doesn't pollute real data.
  const year = 2099;

  const previewRes = await fetch(
    `${HOST}/api/tax-ops/rollover?mode=preview&year=${year}`,
    { method: 'POST', headers: authHeaders() },
  );
  if (!previewRes.ok) {
    fail('preview', `HTTP ${previewRes.status}`);
    return;
  }
  const preview = await previewRes.json();
  pass('preview', `${preview.filings_to_create} filings across ${Object.keys(preview.by_tax_type).length} tax types`);

  const commitRes = await fetch(
    `${HOST}/api/tax-ops/rollover?mode=commit&year=${year}`,
    { method: 'POST', headers: authHeaders() },
  );
  if (!commitRes.ok) {
    const body = await commitRes.text();
    fail('commit', `HTTP ${commitRes.status}: ${body.slice(0, 200)}`);
    return;
  }
  const commit = await commitRes.json();
  pass('commit', `inserted ${commit.inserted}/${commit.planned}`);

  // Idempotency check: re-run, expect 0 new inserts.
  const recommitRes = await fetch(
    `${HOST}/api/tax-ops/rollover?mode=commit&year=${year}`,
    { method: 'POST', headers: authHeaders() },
  );
  const recommit = await recommitRes.json();
  if (recommit.inserted !== 0) {
    fail('idempotency', `expected inserted=0, got ${recommit.inserted}`);
    return;
  }
  pass('idempotent re-run', `inserted=0 (planned=${recommit.planned})`);
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log(`QA pre-dogfood — host: ${HOST}`);
  await login();
  console.log('Logged in.');

  await flow1Extract();
  await flow2Aed();
  await flow3Rollover();

  console.log('');
  if (failures === 0) {
    console.log('🟢 ALL FLOWS PASS — safe to dogfood.');
    process.exit(0);
  } else {
    console.log(`🔴 ${failures} failure(s) — investigate before dogfood.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
