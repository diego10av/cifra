// Unit tests for the legal-watch scanner — pure parts only (RSS parsing
// + keyword matching). The DB-touching integration path is exercised
// separately via manual /api/legal-watch/scan calls.

import { describe, it, expect } from 'vitest';
import { matchKeywords, isHighRelevance } from '@/config/legal-watch-keywords';
import { sampleFeedItems } from '@/lib/legal-watch-scan';

describe('legal-watch · keyword matcher', () => {
  it('picks up Art. 135 references in English titles', () => {
    const hits = matchKeywords('CJEU rules on Article 135(1)(g) fund management exemption');
    expect(hits).toContain('Article 135');
    expect(hits).toContain('fund management');
  });

  it('matches Directive article references regardless of spacing', () => {
    const a = matchKeywords('Cross-border supply under Art. 44 of the VAT Directive');
    const b = matchKeywords('Cross-border supply under Article 44 of the Directive');
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
  });

  it('captures recent case names that reshape LU practice', () => {
    const versaofast = matchKeywords('Versãofast ruling widens credit intermediation exemption');
    expect(versaofast.some(k => k.toLowerCase().includes('versãofast') || k.toLowerCase().includes('versaofast'))).toBe(true);

    const blackrock = matchKeywords('BlackRock Investment Management v HMRC — single supply');
    expect(blackrock).toContain('BlackRock');

    const finanzamt = matchKeywords('Finanzamt T II — intra-VAT-group supplies out of scope');
    expect(finanzamt).toContain('Finanzamt T');
  });

  it('matches Luxembourg-specific jurisdiction anchors', () => {
    const hits = matchKeywords('Luxembourg VAT changes after 2024 budget law');
    expect(hits).toContain('Luxembourg VAT');
  });

  it('returns empty array for irrelevant items', () => {
    const hits = matchKeywords('German carbon-tax reform on heavy industry emissions 2026');
    expect(hits).toEqual([]);
  });

  it('is case-insensitive', () => {
    const upper = matchKeywords('CJEU GRAND CHAMBER RULING ON ARTICLE 132');
    const lower = matchKeywords('cjeu grand chamber ruling on article 132');
    expect(upper.length).toBeGreaterThan(0);
    expect(lower.length).toBeGreaterThan(0);
  });
});

describe('legal-watch · high-relevance detection', () => {
  it('flags Luxembourg VAT items as high relevance', () => {
    expect(isHighRelevance('New Luxembourg VAT circular on fund management')).toBe(true);
  });

  it('does not over-flag generic CJEU items', () => {
    expect(isHighRelevance('CJEU judgment on Romanian digital services tax')).toBe(false);
  });
});

describe('legal-watch · sample feed', () => {
  it('returns the three flagship recent cases', () => {
    const items = sampleFeedItems();
    expect(items.length).toBeGreaterThanOrEqual(3);
    const titles = items.map(i => i.title).join(' | ');
    expect(titles).toMatch(/Versãofast/);
    expect(titles).toMatch(/Finanzamt T II/);
    expect(titles).toMatch(/TP/);
  });

  it('all sample items match at least one watchlist keyword', () => {
    for (const item of sampleFeedItems()) {
      const combined = `${item.title}\n${item.summary ?? ''}`;
      expect(matchKeywords(combined).length, `no match for: ${item.title}`).toBeGreaterThan(0);
    }
  });

  it('sample items have stable external_ids so re-running the scan does not duplicate', () => {
    const a = sampleFeedItems();
    const b = sampleFeedItems();
    expect(a.map(i => i.external_id)).toEqual(b.map(i => i.external_id));
  });

  it('sample items carry parseable ISO dates when published_at is set', () => {
    for (const item of sampleFeedItems()) {
      if (item.published_at) {
        expect(Number.isNaN(new Date(item.published_at).getTime())).toBe(false);
      }
    }
  });
});
