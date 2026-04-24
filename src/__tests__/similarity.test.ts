// Unit tests for src/lib/similarity.ts — the entity-dedup helper.
// Stint 40.A. Focus on real-world name variations Diego's Excel import
// produced so we lock the behaviour against regressions.

import { describe, it, expect } from 'vitest';
import {
  normalizeForMatch, similarityScore, levenshtein, clusterDuplicates,
} from '@/lib/similarity';

describe('normalizeForMatch', () => {
  it('strips punctuation, case, and whitespace variants', () => {
    expect(normalizeForMatch('Avallon MBO Fund III SCA;')).toBe('avallon mbo fund iii');
    expect(normalizeForMatch('Avallon MBO Fund III S.C.A.')).toBe('avallon mbo fund iii');
    expect(normalizeForMatch('  Avallon  MBO   Fund  III  SCA ')).toBe('avallon mbo fund iii');
  });

  it('strips Luxembourg legal-form suffixes uniformly', () => {
    expect(normalizeForMatch('Acme SARL')).toBe('acme');
    expect(normalizeForMatch('Acme S.à r.l.')).toBe('acme');
    expect(normalizeForMatch('Acme S.a.r.l.')).toBe('acme');
    expect(normalizeForMatch('Acme Fund SCS')).toBe('acme fund');
    expect(normalizeForMatch('Acme Fund SCSp')).toBe('acme fund');
    expect(normalizeForMatch('Acme Fund SICAV-RAIF')).toBe('acme fund');
  });

  it('strips accents so "S.à r.l." matches "S.a r.l."', () => {
    expect(normalizeForMatch('Société')).toBe('societe');
    expect(normalizeForMatch('Portobello Capital Sécondary')).toBe(
      normalizeForMatch('Portobello Capital Secondary'),
    );
  });

  it('returns empty string for null / undefined / empty', () => {
    expect(normalizeForMatch(null)).toBe('');
    expect(normalizeForMatch(undefined)).toBe('');
    expect(normalizeForMatch('')).toBe('');
    expect(normalizeForMatch('   ')).toBe('');
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  it('counts single-edit operations correctly', () => {
    expect(levenshtein('abc', 'ab')).toBe(1);      // deletion
    expect(levenshtein('ab', 'abc')).toBe(1);      // insertion
    expect(levenshtein('abc', 'abd')).toBe(1);     // substitution
  });

  it('handles empty strings', () => {
    expect(levenshtein('', '')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
});

describe('similarityScore — real-world Luxembourg name variants', () => {
  it('scores 1.0 for identical names after normalisation', () => {
    expect(similarityScore('Avallon MBO Fund III SCA;', 'Avallon MBO Fund III S.C.A.')).toBe(1);
    expect(similarityScore('Mill Reef Capital GP S.à r.l.', 'Mill Reef Capital GP SARL')).toBe(1);
  });

  it('handles case + whitespace differences as identical', () => {
    expect(similarityScore('BlackPeak Capital SARL', 'blackpeak  capital  sarl')).toBe(1);
  });

  it('scores high (> 0.85) for single-letter typos on long names', () => {
    const score = similarityScore(
      'Portobello Capital Secondary Fund II',
      'Portobello Capitl Secondary Fund II',  // typo: missing "a"
    );
    expect(score).toBeGreaterThan(0.85);
    expect(score).toBeLessThan(1);
  });

  it('scores low (< 0.70) for clearly different names', () => {
    expect(similarityScore('Peninsula Holdings', 'Trilantic Europe V')).toBeLessThan(0.70);
    expect(similarityScore('Acme SARL', 'Zulu SARL')).toBeLessThan(0.70);
  });

  it('returns 0 for null / empty inputs', () => {
    expect(similarityScore(null, 'abc')).toBe(0);
    expect(similarityScore('abc', '')).toBe(0);
    expect(similarityScore('', '')).toBe(0);
  });

  it('treats short strings conservatively (no false positives)', () => {
    // "A" and "B" would naively score 0.5; we refuse short-name matches.
    expect(similarityScore('A', 'B')).toBe(0);
    expect(similarityScore('AB', 'CD')).toBe(0);
  });
});

describe('clusterDuplicates', () => {
  it('groups near-duplicate entities into one cluster per canonical name', () => {
    const items = [
      { id: '1', name: 'Avallon MBO Fund III SCA;' },
      { id: '2', name: 'Avallon MBO Fund III S.C.A.' },
      { id: '3', name: 'Avallon MBO Fund III S C A' },
      { id: '4', name: 'Mill Reef Capital GP S.à r.l.' },
      { id: '5', name: 'Mill Reef Capital GP SARL' },
      { id: '6', name: 'Unrelated Entity SARL' },
    ];
    const clusters = clusterDuplicates(items, 0.85);
    expect(clusters).toHaveLength(2);
    const sorted = clusters.map(c => c.members.map(m => m.id).sort());
    // Avallon trio
    expect(sorted).toContainEqual(['1', '2', '3']);
    // Mill Reef pair
    expect(sorted).toContainEqual(['4', '5']);
  });

  it('skips singletons (entities without any duplicate)', () => {
    const items = [
      { id: '1', name: 'Acme SARL' },
      { id: '2', name: 'Zulu Fund SCSp' },
      { id: '3', name: 'Different Name LLC' },
    ];
    expect(clusterDuplicates(items, 0.85)).toHaveLength(0);
  });

  it('returns clusters sorted by confidence desc', () => {
    const items = [
      // High-confidence pair (identical after normalisation)
      { id: '1', name: 'Acme Fund III SCA' },
      { id: '2', name: 'Acme Fund III S.C.A.' },
      // Lower-confidence pair (single-char typo)
      { id: '3', name: 'Portobello Capital Fund' },
      { id: '4', name: 'Portobello Capitl Fund' },
    ];
    const clusters = clusterDuplicates(items, 0.85);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]!.confidence).toBeGreaterThanOrEqual(clusters[1]!.confidence);
    expect(clusters[0]!.confidence).toBe(1);
  });
});
