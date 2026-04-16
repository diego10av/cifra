// Unit tests for the validator-agent response parser.
//
// The LLM side is not tested here (would need a live Opus call). What
// IS tested: that model output is parsed robustly, malformed items are
// dropped instead of crashing the batch, severity ordering is applied,
// and unknown treatment codes / unknown legal_refs are rejected.

import { describe, it, expect } from 'vitest';
import { parseAndValidateFindings } from '@/lib/validator';

describe('validator — response parser', () => {
  it('returns [] on unparseable input', () => {
    expect(parseAndValidateFindings('not json at all')).toEqual([]);
    expect(parseAndValidateFindings('')).toEqual([]);
  });

  it('returns [] when the parsed value is not an array', () => {
    expect(parseAndValidateFindings('{"foo": 1}')).toEqual([]);
  });

  it('extracts the first valid JSON array even when surrounded by prose', () => {
    const raw = 'Here is my review:\n\n[{"severity":"critical","category":"classification","reasoning":"Foreign supplier VAT classified as LU import VAT","legal_refs":["LTVA_ART_27"]}]\n\nDone.';
    const out = parseAndValidateFindings(raw);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe('critical');
  });

  it('drops findings with missing reasoning', () => {
    const raw = JSON.stringify([
      { severity: 'critical', category: 'classification', reasoning: '', legal_refs: ['LTVA_ART_27'] },
      { severity: 'high', category: 'evidence', reasoning: 'ok', legal_refs: ['LTVA_ART_61'] },
    ]);
    const out = parseAndValidateFindings(raw);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe('high');
  });

  it('drops findings with no legal_refs or with only unknown refs', () => {
    const raw = JSON.stringify([
      { severity: 'high', category: 'evidence', reasoning: 'no refs', legal_refs: [] },
      { severity: 'high', category: 'evidence', reasoning: 'unknown only', legal_refs: ['NOT_A_SOURCE'] },
      { severity: 'high', category: 'evidence', reasoning: 'mixed', legal_refs: ['NOT_A_SOURCE', 'LTVA_ART_44'] },
    ]);
    const out = parseAndValidateFindings(raw);
    expect(out).toHaveLength(1);
    expect(out[0].legal_refs).toEqual(['LTVA_ART_44']);
  });

  it('drops unknown severity or category values', () => {
    const raw = JSON.stringify([
      { severity: 'apocalyptic', category: 'classification', reasoning: 'r', legal_refs: ['LTVA'] },
      { severity: 'critical', category: 'vibes', reasoning: 'r', legal_refs: ['LTVA'] },
      { severity: 'critical', category: 'classification', reasoning: 'r', legal_refs: ['LTVA'] },
    ]);
    const out = parseAndValidateFindings(raw);
    expect(out).toHaveLength(1);
  });

  it('drops suggested_treatment if not a known code (but keeps the finding)', () => {
    const raw = JSON.stringify([
      {
        severity: 'high',
        category: 'classification',
        current_treatment: 'LUX_17',
        suggested_treatment: 'MADE_UP_CODE',
        reasoning: 'should be rated differently',
        legal_refs: ['LTVA_ART_40'],
      },
    ]);
    const out = parseAndValidateFindings(raw);
    expect(out).toHaveLength(1);
    // suggested_treatment nulled rather than letting garbage propagate to UI
    expect(out[0].suggested_treatment).toBeNull();
    expect(out[0].current_treatment).toBe('LUX_17');
  });

  it('accepts a known suggested_treatment', () => {
    const raw = JSON.stringify([
      {
        severity: 'critical',
        category: 'classification',
        line_id: 'ln_123',
        invoice_id: 'inv_456',
        current_treatment: 'LUX_17',
        suggested_treatment: 'LUX_17_NONDED',
        reasoning: 'Description is client entertainment',
        legal_refs: ['LTVA_ART_54'],
      },
    ]);
    const out = parseAndValidateFindings(raw);
    expect(out).toHaveLength(1);
    expect(out[0].suggested_treatment).toBe('LUX_17_NONDED');
    expect(out[0].line_id).toBe('ln_123');
    expect(out[0].invoice_id).toBe('inv_456');
  });

  it('sorts findings by severity (critical first)', () => {
    const raw = JSON.stringify([
      { severity: 'info', category: 'completeness', reasoning: 'i', legal_refs: ['LTVA'] },
      { severity: 'critical', category: 'classification', reasoning: 'c', legal_refs: ['LTVA'] },
      { severity: 'medium', category: 'evidence', reasoning: 'm', legal_refs: ['LTVA'] },
      { severity: 'low', category: 'legal_risk', reasoning: 'l', legal_refs: ['LTVA'] },
      { severity: 'high', category: 'classification', reasoning: 'h', legal_refs: ['LTVA'] },
    ]);
    const out = parseAndValidateFindings(raw);
    expect(out.map(f => f.severity)).toEqual(['critical', 'high', 'medium', 'low', 'info']);
  });

  it('handles line_id / invoice_id as null for declaration-scope findings', () => {
    const raw = JSON.stringify([
      {
        severity: 'info',
        category: 'reconciliation',
        reasoning: 'Turnover total diverges from prior year by more than 50%.',
        legal_refs: ['LTVA'],
      },
    ]);
    const out = parseAndValidateFindings(raw);
    expect(out[0].line_id).toBeNull();
    expect(out[0].invoice_id).toBeNull();
  });
});
