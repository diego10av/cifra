import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchECBRate, extractLatestRate, shiftDate } from '@/lib/ecb';

describe('shiftDate', () => {
  it('shifts forward by N days', () => {
    expect(shiftDate('2026-04-17', 3)).toBe('2026-04-20');
  });

  it('shifts backward by N days', () => {
    expect(shiftDate('2026-04-17', -7)).toBe('2026-04-10');
  });

  it('handles month boundaries', () => {
    expect(shiftDate('2026-01-02', -3)).toBe('2025-12-30');
  });

  it('handles leap day', () => {
    expect(shiftDate('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('extractLatestRate', () => {
  it('extracts the highest-index observation from SDMX-JSON', () => {
    const payload = {
      dataSets: [
        {
          series: {
            '0:0:0:0:0': {
              observations: {
                '0': [1.08],
                '1': [1.09],
                '2': [1.10],
              },
            },
          },
        },
      ],
    };
    expect(extractLatestRate(payload)).toBe(1.10);
  });

  it('skips non-numeric / infinite observations and picks the latest valid', () => {
    const payload = {
      dataSets: [
        {
          series: {
            '0:0:0:0:0': {
              observations: {
                '0': [1.05],
                '1': [Infinity],
                '2': [NaN],
              },
            },
          },
        },
      ],
    };
    expect(extractLatestRate(payload)).toBe(1.05);
  });

  it('returns null for missing dataSets', () => {
    expect(extractLatestRate({})).toBe(null);
    expect(extractLatestRate(null)).toBe(null);
    expect(extractLatestRate({ dataSets: [] })).toBe(null);
  });

  it('returns null when observations are empty', () => {
    expect(extractLatestRate({
      dataSets: [{ series: { '0:0:0:0:0': { observations: {} } } }],
    })).toBe(null);
  });

  it('returns null on malformed payloads without throwing', () => {
    expect(extractLatestRate('not an object')).toBe(null);
    expect(extractLatestRate(42)).toBe(null);
    expect(extractLatestRate(undefined)).toBe(null);
  });
});

describe('fetchECBRate', () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it('returns 1 for EUR immediately (no network)', async () => {
    const rate = await fetchECBRate('EUR', '2026-04-17');
    expect(rate).toBe(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects invalid currency format', async () => {
    expect(await fetchECBRate('us', '2026-04-17')).toBe(null);
    expect(await fetchECBRate('USDX', '2026-04-17')).toBe(null);
    expect(await fetchECBRate('', '2026-04-17')).toBe(null);
  });

  it('rejects invalid date format', async () => {
    expect(await fetchECBRate('USD', '17-04-2026')).toBe(null);
    expect(await fetchECBRate('USD', '2026-4-17')).toBe(null);
    expect(await fetchECBRate('USD', 'not-a-date')).toBe(null);
  });

  it('fetches + parses when given valid input', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        dataSets: [{ series: { '0:0:0:0:0': { observations: { '0': [1.087] } } } }],
      }),
    });

    const rate = await fetchECBRate('USD', '2026-04-17');
    expect(rate).toBeCloseTo(1.087);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null on network error', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('ENOTFOUND'),
    );
    const rate = await fetchECBRate('GBP', '2026-04-17');
    expect(rate).toBe(null);
  });

  it('returns null when ECB responds non-200', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    const rate = await fetchECBRate('CHF', '2026-04-17');
    expect(rate).toBe(null);
  });
});
