// ─────────────────────────────────────────────────────────────────────
// legal-watch-curia — direct RSS fetcher for CJEU rulings.
//
// Rationale: VATupdate is a convenient aggregator but adds noise
// (commentary + opinion posts alongside rulings) and latency (they
// post hours or days after a judgment is published). curia.europa.eu
// publishes an official RSS of "latest rulings" the same day; signal
// is much higher for an auditor-facing tool.
//
// Scope:
//   - Fetch https://curia.europa.eu/jcms/jcms/Jo2_7045/en/?rss=1
//     (official "Latest rulings" RSS feed).
//   - Filter to VAT-adjacent items (title / description match any of
//     the multilingual VAT keywords).
//   - Return as FeedItem[] with source='curia' so the rest of the
//     scan pipeline (keyword match, triage, drafter, DB insert) runs
//     unchanged.
//
// Failure model:
//   - Network timeout, non-200, or malformed XML → throw. The scanner
//     loop catches and logs to the ScanReport; VATupdate is still
//     fetched independently so a Curia outage doesn't kill the run.
// ─────────────────────────────────────────────────────────────────────

import { parseRss, type FeedItem } from '@/lib/legal-watch-scan';

/** Official CJEU "latest rulings" RSS feed (English-language). */
const CURIA_FEED = 'https://curia.europa.eu/jcms/jcms/Jo2_7045/en/?rss=1';

/** Multilingual "this case is about VAT" signal. Narrow — we only keep
 *  items where one of these phrases appears in the title or the RSS
 *  summary. The downstream keyword filter (legal-watch-keywords.ts)
 *  still runs on top, further narrowing to LU-relevant items. */
const VAT_MARKERS = [
  'VAT',
  'value added tax',
  'value-added tax',
  'TVA',
  'taxe sur la valeur ajoutée',
  'Directive 2006/112',
  'Directive 2006/112/EC',
  'Council Directive 2006/112',
  'VAT Directive',
];

function isVatAdjacent(item: FeedItem): boolean {
  const hay = `${item.title}\n${item.summary ?? ''}`.toLowerCase();
  return VAT_MARKERS.some(m => hay.includes(m.toLowerCase()));
}

/** Fetch + parse + VAT-filter the Curia "latest rulings" feed.
 *
 *  Timeout 10 s (slightly more generous than VATupdate because the
 *  curia.europa.eu frontend has historically been slower). Returns
 *  an empty array if the feed has no VAT-adjacent items today — a
 *  quiet day on the CJEU is a normal outcome, not an error. */
export async function fetchCuriaRss(): Promise<FeedItem[]> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(CURIA_FEED, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'cifra-legal-watch/1.0 (+https://cifracompliance.com)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*;q=0.1',
      },
    });
    if (!res.ok) throw new Error(`Curia feed HTTP ${res.status}`);
    const xml = await res.text();
    const parsed = parseRss(xml, 'curia');
    return parsed.filter(isVatAdjacent);
  } finally {
    clearTimeout(timeout);
  }
}
