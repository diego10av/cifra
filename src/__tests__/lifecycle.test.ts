import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getValidNextStates,
  checkApprovalBlocking,
  type DeclarationStatus,
} from '@/lib/lifecycle';

describe('canTransition — declaration state machine', () => {
  it('allows forward path through the happy-path lifecycle', () => {
    const path: DeclarationStatus[] = [
      'created', 'uploading', 'extracting', 'classifying', 'review', 'approved', 'filed', 'paid',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it('refuses skipping steps (e.g. classifying → paid)', () => {
    expect(canTransition('classifying', 'paid')).toBe(false);
    expect(canTransition('created', 'review')).toBe(false);
    expect(canTransition('uploading', 'approved')).toBe(false);
  });

  it('refuses backwards transitions except the allowed reopen set', () => {
    // Not allowed: approved → uploading (two-step backtrack)
    expect(canTransition('approved', 'uploading')).toBe(false);
    // Not allowed: paid → filed (even though they are adjacent)
    expect(canTransition('paid', 'filed')).toBe(false);
  });

  it('allows the three reopen transitions', () => {
    expect(canTransition('review', 'uploading')).toBe(true);
    expect(canTransition('approved', 'review')).toBe(true);
    expect(canTransition('filed', 'review')).toBe(true);
  });

  it('refuses a transition from a state to itself', () => {
    expect(canTransition('review', 'review')).toBe(false);
  });
});

describe('getValidNextStates', () => {
  it('returns only forward + reopen options from review', () => {
    const next = getValidNextStates('review');
    expect(next).toContain('approved');
    expect(next).toContain('uploading'); // reopen path
    expect(next).not.toContain('paid');
  });

  it('allows reopening from paid back to review (rectification path)', () => {
    // Post-stint-12: paid → review is legal for rectification after
    // payment. The UI surfaces it as a danger-styled "Un-file & reopen"
    // button with strong confirmation copy.
    expect(getValidNextStates('paid')).toEqual(['review']);
  });

  it('returns the single next step from created', () => {
    expect(getValidNextStates('created')).toEqual(['uploading']);
  });
});

describe('checkApprovalBlocking — PRD §2.3 gate', () => {
  const ok = { treatment: 'EXEMPT_44', flag: false, flag_acknowledged: false, state: 'classified' };

  it('approves when all lines are classified + non-flagged', () => {
    const result = checkApprovalBlocking([ok, ok, ok], 1234);
    expect(result.canApprove).toBe(true);
    expect(result.blockingErrors).toEqual([]);
  });

  it('blocks when there are no lines', () => {
    const result = checkApprovalBlocking([], 0);
    expect(result.canApprove).toBe(false);
    expect(result.blockingErrors[0]).toMatch(/No invoice lines/);
  });

  it('ignores deleted lines when counting activity', () => {
    const result = checkApprovalBlocking([
      { ...ok, state: 'deleted' },
      { ...ok, state: 'deleted' },
    ], 0);
    expect(result.canApprove).toBe(false);
    expect(result.blockingErrors[0]).toMatch(/No invoice lines/);
  });

  it('blocks on an unclassified line', () => {
    const result = checkApprovalBlocking([
      ok,
      { ...ok, treatment: null },
      ok,
    ], 1000);
    expect(result.canApprove).toBe(false);
    expect(result.blockingErrors.some(e => /no treatment/.test(e))).toBe(true);
  });

  it('blocks on unacknowledged flags', () => {
    const result = checkApprovalBlocking([
      ok,
      { ...ok, flag: true, flag_acknowledged: false },
    ], 1000);
    expect(result.canApprove).toBe(false);
    expect(result.blockingErrors.some(e => /flagged/.test(e))).toBe(true);
  });

  it('approves when a flag is acknowledged', () => {
    const result = checkApprovalBlocking([
      ok,
      { ...ok, flag: true, flag_acknowledged: true },
    ], 1000);
    expect(result.canApprove).toBe(true);
  });

  it('blocks when total VAT is negative', () => {
    const result = checkApprovalBlocking([ok], -50);
    expect(result.canApprove).toBe(false);
    expect(result.blockingErrors.some(e => /negative/.test(e))).toBe(true);
  });

  it('stacks multiple blocking errors rather than reporting only the first', () => {
    const result = checkApprovalBlocking([
      { ...ok, treatment: null },
      { ...ok, flag: true, flag_acknowledged: false },
    ], -10);
    expect(result.canApprove).toBe(false);
    expect(result.blockingErrors.length).toBeGreaterThanOrEqual(3);
  });
});
