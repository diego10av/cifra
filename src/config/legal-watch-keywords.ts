// ─────────────────────────────────────────────────────────────────────
// Legal-watch keyword catalogue
//
// Used by the scanner (src/lib/legal-watch-scan.ts) to decide whether a
// fetched item is relevant to cifra's LU VAT classifier. Kept as a
// separate config file (vs. inlined in the scanner) so the reviewer
// can extend the watchlist when a new CJEU doctrine emerges without
// touching the scanner logic.
//
// Principle: err on the side of broader matching. A false-positive
// that the reviewer dismisses in 2 seconds is much cheaper than a
// missed CJEU judgment that would have reshaped a classification rule.
// ─────────────────────────────────────────────────────────────────────

/** Broad topical keywords — any hit on any of these routes the item
 *  into the queue. Case-insensitive substring match on the fetched
 *  title + summary. */
export const LEGAL_WATCH_KEYWORDS: readonly string[] = [
  // ─ Directive articles cifra cites most
  'Article 9a', 'Art. 9a',
  'Article 11', 'Art. 11',
  'Article 44', 'Art. 44',
  'Article 132', 'Art. 132',
  'Article 135', 'Art. 135',
  'Article 138', 'Art. 138',
  'Article 169', 'Art. 169',
  'Article 173', 'Art. 173',
  'Article 196', 'Art. 196',
  'Article 199', 'Art. 199',
  // ─ LTVA articles
  'LTVA Art. 17', 'LTVA Art. 44', 'LTVA Art. 45',
  'LTVA Art. 49', 'LTVA Art. 50', 'LTVA Art. 56',
  'LTVA Art. 60ter', 'LTVA Art. 61',
  // ─ Concepts
  'fund management', 'special investment fund',
  'management of a special investment fund', 'UCITS', 'AIFM', 'AIFMD',
  'credit intermediation', 'negotiation of credit',
  'securitisation', 'securitization', 'securitisation vehicle',
  'VAT group', 'VAT grouping', 'intra-group supply',
  'reverse charge', 'place of supply',
  'fixed establishment',
  'director fee', 'board member',
  'holding company', 'passive holding', 'active holding', 'SOPARFI',
  'pro-rata', 'pro rata deduction',
  'input VAT deduction', 'input-VAT recovery',
  'margin scheme',
  'carry interest', 'carried interest', 'waterfall',
  'cost-sharing', 'independent group of persons', 'IGP',
  'real-estate letting', 'immovable property',
  'e-invoicing', 'Peppol', 'ViDA',
  // ─ Jurisdictions that anchor LU practice
  'Luxembourg VAT', 'Luxembourg tax', 'Luxembourg fund',
  'AED circular', 'AED Administration de l\'enregistrement',
  // ─ Courts / sources
  'Court of Justice', 'CJEU', 'General Court',
  'Tribunal administratif', 'Cour administrative',
  'Tribunal de l\'Union européenne',
  // ─ Specific recent case names that we expect to see follow-ups on
  'BlackRock', 'Fiscale Eenheid', 'Polysar', 'Cibo',
  'Finanzamt T', 'Skandia', 'Danske Bank',
  'Kaplan', 'DNB Banka', 'Aviva',
  'Versãofast', 'Versaofast',
  'Ludwig', 'DTZ Zadelhoff', 'Aspiro', 'Franck',
  'DBKAG', 'ATP Pension', 'BBL', 'Wheels',
  'Morgan Stanley', 'Titanium', 'Cabot Plastics', 'Fenix',
  'Deutsche Bank', 'Commission v Luxembourg',
  'GfBk', 'Marle', 'Larentia',
];

/** Highest-confidence matches — if ANY of these hit, the item is
 *  flagged as "high relevance" and surfaces at the top of the queue
 *  regardless of fetch order. */
export const HIGH_RELEVANCE_KEYWORDS: readonly string[] = [
  'Luxembourg VAT',
  'Luxembourg fund',
  'Luxembourg securitisation',
  'AED circular',
  'Art. 44§1',
  'Article 44(1)',
  'Tribunal administratif de Luxembourg',
];

/** Fast case-insensitive matcher used by the scanner. Returns the
 *  subset of keywords that matched the input text. */
export function matchKeywords(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const kw of LEGAL_WATCH_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) hits.push(kw);
  }
  return hits;
}

/** Does the text include any high-relevance keyword? */
export function isHighRelevance(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return HIGH_RELEVANCE_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}
