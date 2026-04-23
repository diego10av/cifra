import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, logAudit } from '@/lib/db';
import { anthropicCreate } from '@/lib/anthropic-wrapper';

// POST /api/crm/scheduled/lead-scoring
//
// Monthly cron (1st of each month, 07:00 CET). Scores up to 50 lead
// / prospect contacts using Haiku 4.5 — produces a 0-100 score +
// plain-English reasoning. We use Haiku (not Opus) because lead
// scoring is a moderately structured task: parse a small context,
// rank against straightforward heuristics (has-job-title, is-at-PE-
// fund, has-email, recent-engagement, company-classification), and
// output JSON. Opus would overkill at 15x the cost.
//
// Budget: 50 contacts × ~1k tokens each × Haiku pricing (~€0.0003
// per row) = ~€0.02/month. A rounding error.
//
// Idempotency: contacts are selected oldest-scored-first (NULLS
// FIRST), so re-running won't thrash the same contacts; everyone
// gets refreshed on a rolling cadence. Budget-bounded hard cap
// prevents pathological runs.
const MAX_CONTACTS_PER_RUN = 50;
const MODEL = 'claude-haiku-4-5-20251001';

export async function POST(_request: NextRequest) {
  const now = new Date();

  // Pick candidates: active leads/prospects, oldest-scored first.
  const contacts = await query<{
    id: string;
    full_name: string;
    email: string | null;
    job_title: string | null;
    lifecycle_stage: string | null;
    engagement_level: string | null;
    lead_score: number | null;
    lead_score_updated_at: string | null;
    role_tags: string[] | null;
    source: string | null;
    company_names: string | null;
    company_classifications: string | null;
    recent_activity_count: number | null;
    total_opps_eur: number | null;
  }>(
    `SELECT c.id, c.full_name, c.email, c.job_title, c.lifecycle_stage,
            c.engagement_level, c.lead_score, c.lead_score_updated_at,
            c.role_tags, c.source,
            (SELECT string_agg(co.company_name, ' · ' ORDER BY co.company_name)
               FROM crm_contact_companies cc2
               JOIN crm_companies co ON co.id = cc2.company_id
              WHERE cc2.contact_id = c.id AND co.deleted_at IS NULL) AS company_names,
            (SELECT string_agg(DISTINCT co.classification, ' · ')
               FROM crm_contact_companies cc2
               JOIN crm_companies co ON co.id = cc2.company_id
              WHERE cc2.contact_id = c.id AND co.deleted_at IS NULL
                AND co.classification IS NOT NULL) AS company_classifications,
            (SELECT COUNT(*)::int
               FROM crm_activity_contacts ac
               JOIN crm_activities a ON a.id = ac.activity_id
              WHERE ac.contact_id = c.id
                AND a.activity_date >= (CURRENT_DATE - INTERVAL '180 days')) AS recent_activity_count,
            (SELECT COALESCE(SUM(o.estimated_value_eur), 0)
               FROM crm_opportunities o
              WHERE o.primary_contact_id = c.id AND o.deleted_at IS NULL) AS total_opps_eur
       FROM crm_contacts c
      WHERE c.deleted_at IS NULL
        AND c.lifecycle_stage IN ('lead', 'prospect')
      ORDER BY c.lead_score_updated_at ASC NULLS FIRST, c.created_at ASC
      LIMIT $1`,
    [MAX_CONTACTS_PER_RUN],
  );

  const results: Array<{ contact_id: string; score: number; reasoning: string; ok: boolean }> = [];
  let errorCount = 0;

  for (const c of contacts) {
    try {
      const prompt = buildPrompt(c);
      const message = await anthropicCreate(
        {
          model: MODEL,
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
          system:
`You are a B2B lead-scoring analyst for a Luxembourg private-equity law firm.
Score each contact from 0-100 on fit + engagement + revenue potential. Return
ONLY valid JSON with two keys: {"lead_score": <int 0-100>, "reasoning": "<1-2 sentences max>"}.
Do not include any preamble or markdown.`,
        },
        { agent: 'other', label: `lead-score:${c.id}` },
      );

      const text = message.content
        .map(b => b.type === 'text' ? b.text : '')
        .join('').trim();
      const parsed = parseScoreResponse(text);

      if (parsed === null) {
        errorCount += 1;
        results.push({ contact_id: c.id, score: 0, reasoning: 'parse_failed', ok: false });
        continue;
      }

      await execute(
        `UPDATE crm_contacts
            SET lead_score = $1,
                lead_score_reasoning = $2,
                lead_score_updated_at = NOW(),
                updated_at = NOW()
          WHERE id = $3`,
        [parsed.lead_score, parsed.reasoning, c.id],
      );
      await logAudit({
        action: 'lead_scored',
        targetType: 'crm_contact',
        targetId: c.id,
        field: 'lead_score',
        oldValue: String(c.lead_score ?? ''),
        newValue: String(parsed.lead_score),
        reason: `Lead scored ${parsed.lead_score}/100: ${parsed.reasoning.slice(0, 120)}`,
      });
      results.push({ contact_id: c.id, score: parsed.lead_score, reasoning: parsed.reasoning, ok: true });
    } catch (e) {
      errorCount += 1;
      results.push({
        contact_id: c.id, score: 0,
        reasoning: e instanceof Error ? e.message : 'anthropic_error',
        ok: false,
      });
    }
  }

  return NextResponse.json({
    scanned: contacts.length,
    scored: results.filter(r => r.ok).length,
    errors: errorCount,
    ran_at: now.toISOString(),
    results,
  });
}

// Allow GET for manual testing.
export const GET = POST;

interface ContactRow {
  id: string;
  full_name: string;
  email: string | null;
  job_title: string | null;
  lifecycle_stage: string | null;
  engagement_level: string | null;
  role_tags: string[] | null;
  source: string | null;
  company_names: string | null;
  company_classifications: string | null;
  recent_activity_count: number | null;
  total_opps_eur: number | null;
}

function buildPrompt(c: ContactRow): string {
  return `Score this lead 0-100 for a LU PE/fund law firm.

Name: ${c.full_name}
Role: ${c.job_title ?? 'unknown'}
Contact: ${c.email ? 'email on file' : 'no email'}
Lifecycle: ${c.lifecycle_stage ?? '—'}
Engagement: ${c.engagement_level ?? 'unknown'} (last 180d: ${c.recent_activity_count ?? 0} activities)
Source: ${c.source ?? '—'}
Role tags: ${(c.role_tags ?? []).join(', ') || '—'}
Companies: ${c.company_names ?? 'none linked'}
Company tier: ${c.company_classifications ?? 'unknown'}
Open opportunity value: €${(c.total_opps_eur ?? 0).toFixed(0)}

High score drivers: Key-Account company classification, PE/fund role, decision-maker tag,
active engagement, non-trivial open opps. Low score drivers: no-email, occasional tier,
lapsed, no activity ever, no job title.

Return JSON only.`;
}

function parseScoreResponse(raw: string): { lead_score: number; reasoning: string } | null {
  // Strip fences if the model added any.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const obj = JSON.parse(cleaned);
    const score = Math.round(Number(obj.lead_score));
    if (!Number.isFinite(score) || score < 0 || score > 100) return null;
    const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning.trim().slice(0, 500) : '';
    if (!reasoning) return null;
    return { lead_score: score, reasoning };
  } catch {
    return null;
  }
}

// Silence unused import lint — queryOne is exported but not used here.
void queryOne;
