'use client';

// Validator panel — second-opinion Opus review UI.
// Lives as a sticky right-side drawer when open; can be closed to reclaim
// screen real estate. The panel is the visible face of the Option C
// backend work (runValidator + resolveFinding endpoints).
//
// UX principle: treat findings like code-review comments. Each has a
// severity, a reasoning block with legal citations, and three
// resolutions (accept / reject / defer) that the reviewer uses to
// acknowledge the Opus observation. Closed findings collapse.

import { useCallback, useEffect, useState } from 'react';
import {
  XIcon, RefreshCwIcon, SparklesIcon, AlertOctagonIcon,
  AlertTriangleIcon, InfoIcon, CheckCircle2Icon, CircleOffIcon,
  ClockIcon, ChevronDownIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { resolveLegalSource } from '@/config/legal-sources';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingCategory = 'classification' | 'evidence' | 'completeness' | 'legal_risk' | 'reconciliation';
type FindingStatus = 'open' | 'accepted' | 'rejected' | 'deferred';

export interface ValidatorFinding {
  id: string;
  line_id: string | null;
  invoice_id: string | null;
  severity: FindingSeverity;
  category: FindingCategory;
  current_treatment: string | null;
  suggested_treatment: string | null;
  reasoning: string;
  legal_refs: string[];
  status: FindingStatus;
  status_reason: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface ValidatorRun {
  run_id: string | null;
  findings: ValidatorFinding[];
  summary: {
    total: number;
    by_severity: Partial<Record<FindingSeverity, number>>;
    by_status: Partial<Record<FindingStatus, number>>;
  } | null;
}

export function ValidatorPanel({
  declarationId,
  isLocked,
  onClose,
}: {
  declarationId: string;
  isLocked: boolean;
  onClose: () => void;
}) {
  const [run, setRun] = useState<ValidatorRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  /** Info about the most recent POST /api/agents/validate response.
   *  When `cached` is true, the last "Run" click served a cached
   *  validator_runs row instead of paying for a fresh Opus call. */
  const [lastRunMeta, setLastRunMeta] = useState<{ cached: boolean; cachedAgeMin?: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/validate?declaration_id=${declarationId}`);
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = await res.json();
      setRun(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [declarationId]);

  useEffect(() => { load(); }, [load]);

  async function handleRun() {
    if (isLocked) return;
    if (!confirm(
      'Run Opus second-opinion review?\n\n'
      + 'Estimated cost: €0.05–0.15 depending on declaration size. '
      + 'If nothing has changed on the lines since the last run (within 7 days, '
      + 'same model), the cached result is served for free.',
    )) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/agents/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ declaration_id: declarationId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `Run failed (${res.status})`);
      }
      const body = await res.json().catch(() => ({}));
      setLastRunMeta({
        cached: !!body?.cached,
        cachedAgeMin: typeof body?.cached_age_minutes === 'number' ? body.cached_age_minutes : undefined,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function handleResolve(findingId: string, status: 'accepted' | 'rejected' | 'deferred', reason?: string) {
    try {
      const res = await fetch(`/api/validator-findings/${findingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, status_reason: reason ?? null }),
      });
      if (!res.ok) throw new Error('Update failed');
      // Optimistic update
      setRun(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          findings: prev.findings.map(f =>
            f.id === findingId
              ? { ...f, status, status_reason: reason ?? null, resolved_at: new Date().toISOString() }
              : f,
          ),
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const allFindings = run?.findings ?? [];
  const visible = filter === 'open'
    ? allFindings.filter(f => f.status === 'open')
    : allFindings;

  const summary = allFindings.reduce((acc, f) => {
    acc.total += 1;
    if (f.status === 'open') {
      acc.openBySeverity[f.severity] = (acc.openBySeverity[f.severity] || 0) + 1;
    }
    return acc;
  }, { total: 0, openBySeverity: {} as Record<FindingSeverity, number> });

  const hasFindings = allFindings.length > 0;
  const hasOpen = allFindings.some(f => f.status === 'open');

  return (
    <aside className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <header className="px-4 py-3 border-b border-divider bg-gradient-to-br from-brand-50 to-surface flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-500 text-white inline-flex items-center justify-center shrink-0">
          <SparklesIcon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-semibold text-ink tracking-tight">Second-opinion review</h3>
          <p className="text-[11px] text-ink-muted mt-0.5">
            Opus 4.5 audits the classifier output against LU VAT precedent.
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-alt"
          aria-label="Close validator panel"
        >
          <XIcon size={14} />
        </button>
      </header>

      {/* Summary + action */}
      <div className="px-4 py-3 border-b border-divider">
        {hasFindings && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {(['critical', 'high', 'medium', 'low', 'info'] as FindingSeverity[]).map(sev => {
              const count = summary.openBySeverity[sev] || 0;
              if (count === 0) return null;
              return <SeverityBadge key={sev} severity={sev} count={count} />;
            })}
            {!hasOpen && <Badge tone="success">All resolved</Badge>}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            size="sm"
            icon={running ? undefined : <RefreshCwIcon size={12} />}
            onClick={handleRun}
            loading={running}
            disabled={running || isLocked}
          >
            {running ? 'Running…' : hasFindings ? 'Re-run review' : 'Run review'}
          </Button>
          {lastRunMeta?.cached && (
            <span
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-medium"
              title={
                lastRunMeta.cachedAgeMin != null
                  ? `Cached result served — last run ${lastRunMeta.cachedAgeMin} min ago. No Opus call was made. Edit any line to invalidate the cache.`
                  : 'Cached result served — no Opus call was made.'
              }
            >
              ✓ Cached{lastRunMeta.cachedAgeMin != null ? ` · ${lastRunMeta.cachedAgeMin}min` : ''}
            </span>
          )}
          {hasFindings && (
            <div className="flex items-center gap-1 ml-auto">
              <FilterChip active={filter === 'open'} onClick={() => setFilter('open')}>
                Open {hasOpen ? `(${allFindings.filter(f => f.status === 'open').length})` : ''}
              </FilterChip>
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
                All ({summary.total})
              </FilterChip>
            </div>
          )}
        </div>

        {isLocked && (
          <p className="mt-2 text-[11px] text-warning-700 bg-warning-50 border border-[#F6DC8C] rounded-md px-2 py-1.5">
            Declaration is locked. Reopen (approved → review) to re-run the validator.
          </p>
        )}
        {error && (
          <p className="mt-2 text-[11px] text-danger-700 bg-danger-50 border border-[#F4B9B7] rounded-md px-2 py-1.5">
            {error}
          </p>
        )}
      </div>

      {/* Findings list */}
      <div className="flex-1 overflow-y-auto">
        {loading && !run ? (
          <div className="p-6 text-center text-[12px] text-ink-muted">Loading…</div>
        ) : !hasFindings ? (
          <EmptyFindings />
        ) : visible.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-ink-muted">
            All findings resolved. Switch to &quot;All&quot; to see the history.
          </div>
        ) : (
          <ul className="divide-y divide-divider">
            {visible.map(f => (
              <FindingItem key={f.id} finding={f} onResolve={handleResolve} isLocked={isLocked} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

// ═════════════════ Finding item ═════════════════

function FindingItem({
  finding, onResolve, isLocked,
}: {
  finding: ValidatorFinding;
  onResolve: (id: string, status: 'accepted' | 'rejected' | 'deferred', reason?: string) => void;
  isLocked: boolean;
}) {
  const [expanded, setExpanded] = useState(finding.status === 'open');

  const isOpen = finding.status === 'open';
  const severityStyles = getSeverityStyles(finding.severity);

  return (
    <li className={[
      'transition-colors',
      isOpen ? severityStyles.bg : 'bg-surface opacity-75',
    ].join(' ')}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-alt/60"
      >
        <div className={`w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0 ${severityStyles.chip}`}>
          {severityStyles.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={severityStyles.tone}>{finding.severity}</Badge>
            <Badge tone="neutral">{finding.category.replace('_', ' ')}</Badge>
            {!isOpen && <StatusBadge status={finding.status} />}
          </div>
          {finding.current_treatment && (
            <div className="mt-1.5 text-[11.5px] text-ink-soft tabular-nums">
              <span className="text-ink-muted">Current:</span> {finding.current_treatment}
              {finding.suggested_treatment && (
                <>
                  {' '}→{' '}
                  <span className="text-brand-700 font-medium">{finding.suggested_treatment}</span>
                </>
              )}
            </div>
          )}
          <p className="mt-1.5 text-[12px] text-ink leading-relaxed line-clamp-2">
            {finding.reasoning}
          </p>
        </div>
        <ChevronDownIcon
          size={14}
          className={`shrink-0 text-ink-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-[60px] space-y-3 animate-fadeIn">
          {/* Full reasoning */}
          <p className="text-[12.5px] text-ink-soft leading-relaxed">{finding.reasoning}</p>

          {/* Legal refs */}
          {finding.legal_refs.length > 0 && (
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.06em] font-semibold text-ink-muted mb-1.5">
                Legal basis
              </div>
              <div className="flex flex-wrap gap-1.5">
                {finding.legal_refs.map(ref => <LegalRefPill key={ref} id={ref} />)}
              </div>
            </div>
          )}

          {/* Line / invoice reference */}
          {(finding.line_id || finding.invoice_id) && (
            <div className="text-[11px] text-ink-muted">
              {finding.line_id && <span>Line {finding.line_id.slice(-8)}</span>}
              {finding.line_id && finding.invoice_id && <span> · </span>}
              {finding.invoice_id && <span>Invoice {finding.invoice_id.slice(-8)}</span>}
            </div>
          )}

          {/* Resolution status or actions */}
          {isOpen && !isLocked ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-divider">
              <Button
                variant="success" size="sm"
                icon={<CheckCircle2Icon size={12} />}
                onClick={() => onResolve(finding.id, 'accepted')}
              >
                Accept
              </Button>
              <Button
                variant="secondary" size="sm"
                icon={<CircleOffIcon size={12} />}
                onClick={() => {
                  const reason = prompt('Rejection reason (optional):');
                  onResolve(finding.id, 'rejected', reason || undefined);
                }}
              >
                Reject
              </Button>
              <Button
                variant="ghost" size="sm"
                icon={<ClockIcon size={12} />}
                onClick={() => onResolve(finding.id, 'deferred')}
              >
                Defer
              </Button>
            </div>
          ) : isOpen && isLocked ? (
            <div className="text-[11px] text-ink-muted pt-2 border-t border-divider">
              Resolve actions disabled on locked declarations.
            </div>
          ) : (
            <div className="text-[11px] text-ink-muted pt-2 border-t border-divider">
              <span className="font-medium text-ink-soft capitalize">{finding.status}</span>
              {finding.resolved_at && (
                <> on {new Date(finding.resolved_at).toLocaleDateString('en-GB')}</>
              )}
              {finding.status_reason && (
                <div className="mt-1 italic">&ldquo;{finding.status_reason}&rdquo;</div>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ═════════════════ Small presentational components ═════════════════

function EmptyFindings() {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      <div className="w-12 h-12 rounded-full bg-brand-50 border border-brand-100 text-brand-500 inline-flex items-center justify-center mb-3">
        <SparklesIcon size={20} />
      </div>
      <h4 className="text-[13.5px] font-semibold text-ink">No review yet</h4>
      <p className="text-[12px] text-ink-muted mt-1.5 max-w-xs leading-relaxed">
        Run the second-opinion review to audit the classifier&rsquo;s
        decisions. Opus reads every line, checks it against LU VAT
        precedent, and flags issues with full legal citations.
      </p>
      <p className="text-[11px] text-ink-faint mt-3">
        Typical cost: €0.05 – €0.15 per run. Cached until lines change.
      </p>
    </div>
  );
}

function SeverityBadge({ severity, count }: { severity: FindingSeverity; count: number }) {
  const styles = getSeverityStyles(severity);
  return (
    <Badge tone={styles.tone} icon={<span className="scale-75 inline-flex">{styles.icon}</span>}>
      {count} {severity}
    </Badge>
  );
}

function StatusBadge({ status }: { status: FindingStatus }) {
  const map: Record<FindingStatus, { tone: 'success' | 'neutral' | 'amber'; label: string }> = {
    open:     { tone: 'neutral', label: 'Open' },
    accepted: { tone: 'success', label: 'Accepted' },
    rejected: { tone: 'neutral', label: 'Rejected' },
    deferred: { tone: 'amber',   label: 'Deferred' },
  };
  const entry = map[status];
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'h-7 px-2.5 rounded-md text-[11.5px] font-medium transition-colors',
        active ? 'bg-brand-500 text-white' : 'bg-surface border border-border text-ink-soft hover:bg-surface-alt',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function LegalRefPill({ id }: { id: string }) {
  const source = resolveLegalSource(id);
  const label = source ? source.title : id;
  const title = source ? `${source.citation}${source.subject ? `\n\n${source.subject}` : ''}` : id;
  const url = source?.sources_url;
  const inner = (
    <span className="inline-flex items-center gap-1 bg-surface-alt hover:bg-brand-50 hover:text-brand-700 text-ink-soft border border-border rounded px-1.5 py-0.5 text-[11px] transition-colors">
      <span className="font-mono text-[10px] text-ink-muted">{id}</span>
      <span className="max-w-[200px] truncate">{label}</span>
    </span>
  );
  return url ? (
    <a href={url} target="_blank" rel="noopener" title={title}>{inner}</a>
  ) : (
    <span title={title}>{inner}</span>
  );
}

// ═════════════════ Severity styling ═════════════════

function getSeverityStyles(sev: FindingSeverity): {
  tone: 'danger' | 'warning' | 'amber' | 'info' | 'neutral';
  bg: string;
  chip: string;
  icon: React.ReactNode;
} {
  switch (sev) {
    case 'critical':
      return { tone: 'danger',  bg: 'bg-danger-50/30',  chip: 'bg-danger-500 text-white',  icon: <AlertOctagonIcon size={13} /> };
    case 'high':
      return { tone: 'warning', bg: 'bg-brand-50/30',   chip: 'bg-brand-500 text-white',   icon: <AlertTriangleIcon size={13} /> };
    case 'medium':
      return { tone: 'amber',   bg: 'bg-[#FEF3CC]/30',  chip: 'bg-warning-500 text-white', icon: <AlertTriangleIcon size={13} /> };
    case 'low':
      return { tone: 'info',    bg: 'bg-info-50/20',    chip: 'bg-info-500 text-white',    icon: <InfoIcon size={13} /> };
    case 'info':
    default:
      return { tone: 'neutral', bg: 'bg-surface',       chip: 'bg-surface-alt text-ink-muted', icon: <InfoIcon size={13} /> };
  }
}
