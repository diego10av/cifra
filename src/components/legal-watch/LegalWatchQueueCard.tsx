'use client';

// LegalWatchQueueCard — the "live classifier" inbox.
//
// 2026-04-23 redesign driven by Diego's feedback: "no entiendo qué
// quiere decir escalate / flag / dismiss, los tres desaparecen igual".
// The fix is to make each button's effect *visible* on the same page:
//
//   • Recordar (flag)         → item stays visible in "Recordatorios"
//                                section with a yellow chip. Come back
//                                to it whenever you want.
//   • Actualizar reglas (esc.) → item moves to "Pendiente actualizar
//                                reglas" section with a green chip.
//                                You commit to doing something about
//                                the item (or Claude drafts the patch
//                                when migration 024 lands).
//   • Descartar (dismiss)      → item goes to "Descartados" (hidden by
//                                default). Toggle "Mostrar descartados"
//                                to inspect / recover.
//
// The mutation no longer optimistically removes the item from local
// state — we refresh from the server so the item re-appears in its
// new section.

import { useCallback, useEffect, useState } from 'react';
import {
  SparklesIcon, RadioIcon, XIcon, CheckCheckIcon, BookmarkIcon,
  ExternalLinkIcon, Loader2Icon, EyeIcon, EyeOffIcon,
  ChevronDownIcon, ChevronRightIcon, PencilIcon,
} from 'lucide-react';
import { useToast } from '@/components/Toaster';

type TriageSeverity = 'critical' | 'high' | 'medium' | 'low';
type TriageStatus = 'new' | 'flagged' | 'dismissed' | 'escalated';

interface QueueItem {
  id: string;
  source: string;
  external_id: string | null;
  title: string;
  url: string | null;
  summary: string | null;
  published_at: string | null;
  matched_keywords: string[];
  status: TriageStatus;
  created_at: string;
  triaged_by: string | null;
  ai_triage_severity: TriageSeverity | null;
  ai_triage_affected_rules: string[] | null;
  ai_triage_summary: string | null;
  ai_triage_proposed_action: string | null;
  ai_triage_confidence: number | null;
  ai_triage_model: string | null;
  ai_triage_at: string | null;
  // Migration 024 — AI-proposed code patch columns
  ai_patch_diff: string | null;
  ai_patch_target_files: string[] | null;
  ai_patch_reasoning: string | null;
  ai_patch_confidence: number | null;
  ai_patch_model: string | null;
  ai_patch_generated_at: string | null;
  patch_applied_at: string | null;
  patch_applied_by: string | null;
  patch_commit_sha: string | null;
  // Migration 025 — human edit audit on top of AI-drafted patches
  ai_patch_modified_by_human: boolean | null;
  ai_patch_modified_by: string | null;
  ai_patch_modified_at: string | null;
  ai_patch_original_diff: string | null;
}

interface ScanReport {
  source: string;
  fetched: number;
  filtered: number;
  inserted: number;
  skipped_duplicate: number;
  errors: string[];
}

type Tone = 'idle' | 'scanning' | 'success' | 'error';

export function LegalWatchQueueCard() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanState, setScanState] = useState<Tone>('idle');
  const [scanBanner, setScanBanner] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [includeDismissed, setIncludeDismissed] = useState(false);
  const [escalatedOpen, setEscalatedOpen] = useState(true);
  const [flaggedOpen, setFlaggedOpen] = useState(true);
  const [dismissedOpen, setDismissedOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Always request all reviewer-relevant statuses. The server filter
      // returns new + flagged + escalated by default; include dismissed
      // when the toggle is on.
      const qs = includeDismissed ? 'limit=60&include_dismissed=true' : 'limit=40';
      const res = await fetch(`/api/legal-watch/queue?${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json()) as QueueItem[];
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [includeDismissed]);

  useEffect(() => { void load(); }, [load]);

  const runScan = async (source: 'vatupdate' | 'sample') => {
    setScanState('scanning');
    setScanBanner(null);
    try {
      const res = await fetch(
        `/api/legal-watch/scan?source=${source}&fallback=true`,
        { method: 'POST' },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = body?.error?.message || `scan failed (${res.status})`;
        setScanState('error');
        setScanBanner(msg);
        return;
      }
      const reports: ScanReport[] = body.reports ?? [];
      const totalInserted = reports.reduce((a, r) => a + r.inserted, 0);
      const totalFetched = reports.reduce((a, r) => a + r.fetched, 0);
      setScanState('success');
      setScanBanner(
        totalInserted === 0
          ? `Fetched ${totalFetched} items · no new hits (everything already in queue)`
          : `Fetched ${totalFetched} items · ${totalInserted} new hit${totalInserted === 1 ? '' : 's'} added`,
      );
      await load();
    } catch (err) {
      setScanState('error');
      setScanBanner(err instanceof Error ? err.message : 'scan failed');
    }
  };

  const triage = async (id: string, status: 'flagged' | 'dismissed' | 'escalated') => {
    setMutatingId(id);
    try {
      const res = await fetch(`/api/legal-watch/queue/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error(`Could not update item (${res.status})`);
        return;
      }
      // Refresh from server — the item moves to its new section rather
      // than disappearing entirely.
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Network error');
    } finally {
      setMutatingId(null);
    }
  };

  // Split items into the four reviewer sections.
  const newItems       = items.filter(i => i.status === 'new');
  const flaggedItems   = items.filter(i => i.status === 'flagged');
  const escalatedItems = items.filter(i => i.status === 'escalated');
  const dismissedItems = items.filter(i => i.status === 'dismissed');

  const severityPill = (sev: TriageSeverity): string => {
    switch (sev) {
      case 'critical': return 'bg-red-50 text-red-800 border-red-300';
      case 'high':     return 'bg-orange-50 text-orange-800 border-orange-300';
      case 'medium':   return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'low':      return 'bg-surface-alt text-ink-muted border-border';
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
      <header className="px-5 py-4 flex items-start gap-4 border-b border-divider">
        <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-700 inline-flex items-center justify-center shrink-0">
          <RadioIcon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-ink tracking-tight">
              Live feed — candidate jurisprudence & notices
            </h2>
            <span className={`inline-flex items-center h-[18px] px-2 rounded-full text-2xs font-semibold tracking-wide border ${newItems.length > 0 ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-surface-alt text-ink-muted border-border'}`}>
              {loading ? '…' : `${newItems.length} new`}
            </span>
            {escalatedItems.length > 0 && (
              <span className="inline-flex items-center h-[18px] px-2 rounded-full text-2xs font-semibold tracking-wide border bg-emerald-50 text-emerald-800 border-emerald-200">
                {escalatedItems.length} pending rule update
              </span>
            )}
          </div>
          <p className="text-sm text-ink-soft mt-1 leading-relaxed">
            Auto-fetched from public feeds (VATupdate, curia.europa.eu via sample seed),
            filtered by the cifra watchlist, pre-triaged by Opus 4.7.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={() => runScan('sample')}
            disabled={scanState === 'scanning'}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border-strong bg-surface text-sm font-medium text-ink-soft hover:border-brand-300 hover:text-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            title="Insert the three flagship sample cases (Versãofast, Finanzamt T II, C-288/22 TP) so you can see the triage flow even without network"
          >
            <BookmarkIcon size={12} />
            Seed samples
          </button>
          <button
            onClick={() => runScan('vatupdate')}
            disabled={scanState === 'scanning'}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {scanState === 'scanning' ? <Loader2Icon size={12} className="animate-spin" /> : <SparklesIcon size={12} />}
            Scan now
          </button>
        </div>
      </header>

      {scanBanner && (
        <div className={`px-5 py-2 text-sm border-b border-divider ${scanState === 'error' ? 'bg-danger-50 text-danger-800' : 'bg-emerald-50 text-emerald-800'}`}>
          {scanBanner}
        </div>
      )}

      {loading ? (
        <div className="px-5 py-8 text-center text-sm text-ink-muted">Loading queue…</div>
      ) : items.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-ink-muted">
          Queue is empty — no candidate items currently awaiting triage.
          <div className="mt-2 text-xs text-ink-faint">
            Click <strong className="font-semibold">Scan now</strong> to pull the VATupdate feed,
            or <strong className="font-semibold">Seed samples</strong> to drop in the three flagship cases for demo.
          </div>
        </div>
      ) : (
        <>
          {/* ── New items — main queue ── */}
          {newItems.length > 0 && (
            <ItemList
              items={newItems}
              mutatingId={mutatingId}
              onTriage={triage}
              severityPill={severityPill}
              onReload={load}
            />
          )}

          {/* ── Escalated: pending rule update ── */}
          {escalatedItems.length > 0 && (
            <SectionToggle
              open={escalatedOpen}
              onToggle={() => setEscalatedOpen(v => !v)}
              title="Pending rule update"
              subtitle={`${escalatedItems.length} item${escalatedItems.length === 1 ? '' : 's'} you marked for code change`}
              accent="emerald"
            >
              <ItemList
                items={escalatedItems}
                mutatingId={mutatingId}
                onTriage={triage}
                severityPill={severityPill}
                sectionTone="escalated"
                onReload={load}
              />
            </SectionToggle>
          )}

          {/* ── Flagged: reminders ── */}
          {flaggedItems.length > 0 && (
            <SectionToggle
              open={flaggedOpen}
              onToggle={() => setFlaggedOpen(v => !v)}
              title="Reminders"
              subtitle={`${flaggedItems.length} item${flaggedItems.length === 1 ? '' : 's'} to revisit`}
              accent="amber"
            >
              <ItemList
                items={flaggedItems}
                mutatingId={mutatingId}
                onTriage={triage}
                severityPill={severityPill}
                sectionTone="flagged"
                onReload={load}
              />
            </SectionToggle>
          )}

          {/* ── Dismissed — hidden by default ── */}
          <div className="px-5 py-3 border-t border-divider bg-surface-alt/30">
            <button
              onClick={() => {
                if (!includeDismissed) setIncludeDismissed(true);
                setDismissedOpen(v => !v);
              }}
              className="inline-flex items-center gap-2 text-xs text-ink-soft hover:text-ink transition-colors"
              title="Show items you've dismissed — they stay in the database for audit"
            >
              {includeDismissed && dismissedOpen ? <EyeOffIcon size={12} /> : <EyeIcon size={12} />}
              {includeDismissed && dismissedOpen ? 'Hide dismissed items' : 'Show dismissed items'}
              {includeDismissed && dismissedItems.length > 0 && (
                <span className="ml-1 text-2xs text-ink-muted">({dismissedItems.length})</span>
              )}
            </button>
            {includeDismissed && dismissedOpen && (
              <div className="mt-3">
                {dismissedItems.length === 0 ? (
                  <div className="text-xs text-ink-muted italic">No dismissed items.</div>
                ) : (
                  <ItemList
                    items={dismissedItems}
                    mutatingId={mutatingId}
                    onTriage={triage}
                    severityPill={severityPill}
                    sectionTone="dismissed"
                    onReload={load}
                  />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function SectionToggle({
  open, onToggle, title, subtitle, accent, children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  subtitle: string;
  accent: 'emerald' | 'amber';
  children: React.ReactNode;
}) {
  const accentClasses = accent === 'emerald'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
    : 'bg-amber-50 text-amber-800 border-amber-100';
  return (
    <div className="border-t border-divider">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-5 py-2.5 text-left hover:brightness-95 transition-all ${accentClasses}`}
      >
        {open ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs opacity-80">{subtitle}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function ItemList({
  items, mutatingId, onTriage, severityPill, sectionTone, onReload,
}: {
  items: QueueItem[];
  mutatingId: string | null;
  onTriage: (id: string, status: 'flagged' | 'dismissed' | 'escalated') => void;
  severityPill: (sev: TriageSeverity) => string;
  sectionTone?: 'flagged' | 'escalated' | 'dismissed';
  onReload: () => Promise<void> | void;
}) {
  const rowOpacity = sectionTone === 'flagged' || sectionTone === 'escalated' ? 'opacity-90'
    : sectionTone === 'dismissed' ? 'opacity-60'
    : '';
  const statusPill = (s: TriageStatus): string => {
    if (s === 'new')       return 'bg-brand-50 text-brand-700 border-brand-200';
    if (s === 'flagged')   return 'bg-amber-50 text-amber-800 border-amber-200';
    if (s === 'escalated') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    return 'bg-surface-alt text-ink-muted border-border';
  };
  return (
    <ul className="divide-y divide-divider">
      {items.map(item => (
        <li key={item.id} className={`px-5 py-4 hover:bg-surface-alt/50 transition-colors ${rowOpacity}`}>
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {item.ai_triage_severity && (
                  <span className={`inline-flex items-center h-[17px] px-1.5 rounded text-2xs font-semibold uppercase tracking-wide border ${severityPill(item.ai_triage_severity)}`}
                    title={item.ai_triage_summary ?? undefined}
                  >
                    {item.ai_triage_severity}
                  </span>
                )}
                <span className={`inline-flex items-center h-[17px] px-1.5 rounded text-2xs font-semibold uppercase tracking-wide border ${statusPill(item.status)}`}>
                  {item.status === 'escalated' ? 'to update' : item.status === 'flagged' ? 'reminder' : item.status}
                </span>
                <span className="text-xs font-mono text-ink-muted">{item.source}</span>
                {item.external_id && (
                  <span className="text-xs font-mono text-ink-faint">· {item.external_id}</span>
                )}
                {item.published_at && (
                  <span className="text-xs text-ink-muted tabular-nums">
                    · {new Date(item.published_at).toISOString().slice(0, 10)}
                  </span>
                )}
                {item.triaged_by === 'ai_auto' && (
                  <span className="text-2xs text-violet-700 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5">
                    AI auto-dismiss
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-sm font-medium text-ink leading-snug">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener" className="hover:underline inline-flex items-start gap-1">
                    {item.title}
                    <ExternalLinkIcon size={10} className="mt-[3px] shrink-0 text-ink-muted" />
                  </a>
                ) : (
                  item.title
                )}
              </div>

              {/* AI triage block */}
              {item.ai_triage_summary && (
                <div className="mt-2 rounded border border-violet-200 bg-violet-50/60 px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-2xs font-semibold text-violet-800 uppercase tracking-wide">
                    <SparklesIcon size={10} />
                    AI triage
                    {item.ai_triage_confidence != null && (
                      <span className="font-normal text-violet-600">
                        · confidence {Math.round(item.ai_triage_confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ink leading-relaxed">{item.ai_triage_summary}</p>
                  {item.ai_triage_proposed_action && (
                    <p className="mt-1 text-xs text-ink-soft leading-relaxed">
                      <strong className="font-semibold">Proposed action:</strong> {item.ai_triage_proposed_action}
                    </p>
                  )}
                  {item.ai_triage_affected_rules && item.ai_triage_affected_rules.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.ai_triage_affected_rules.map(r => (
                        <span
                          key={r}
                          className="inline-flex items-center h-[17px] px-1.5 rounded bg-white text-violet-800 border border-violet-200 text-2xs font-semibold"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AI-proposed rule patch block — renders when the drafter
                  produced a diff (severity high/critical + confident
                  enough to propose a concrete code change). Collapsed
                  by default; expand to inspect the diff + reasoning. */}
              {item.ai_patch_diff && (
                <PatchProposalBlock
                  id={item.id}
                  diff={item.ai_patch_diff}
                  reasoning={item.ai_patch_reasoning}
                  confidence={item.ai_patch_confidence}
                  targetFiles={item.ai_patch_target_files}
                  appliedAt={item.patch_applied_at}
                  commitSha={item.patch_commit_sha}
                  severity={item.ai_triage_severity}
                  modifiedByHuman={item.ai_patch_modified_by_human}
                  modifiedBy={item.ai_patch_modified_by}
                  onReload={onReload}
                />
              )}

              {item.summary && (
                <p className="mt-2 text-xs text-ink-muted leading-relaxed line-clamp-2">
                  <span className="uppercase text-2xs tracking-wider font-semibold text-ink-faint mr-1">source</span>
                  {item.summary}
                </p>
              )}
              {item.matched_keywords.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.matched_keywords.slice(0, 6).map(kw => (
                    <span
                      key={kw}
                      className="inline-flex items-center h-[18px] px-1.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100 text-2xs font-medium"
                    >
                      {kw}
                    </span>
                  ))}
                  {item.matched_keywords.length > 6 && (
                    <span className="inline-flex items-center h-[18px] px-1.5 text-2xs text-ink-muted">
                      +{item.matched_keywords.length - 6} more
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-1 flex-col">
              {/* Only new + flagged can be re-triaged with all 3 buttons.
                  Escalated items get "Unescalate → back to new" + "Dismiss".
                  Dismissed items get "Restore → new" only. */}
              {item.status === 'new' && (
                <>
                  <TriageButton
                    onClick={() => onTriage(item.id, 'flagged')}
                    disabled={mutatingId === item.id}
                    label="Recordar"
                    title="Keep it visible in the Reminders section. Click this when you want to come back to it later but don't yet have an opinion."
                    tone="amber"
                    icon={<BookmarkIcon size={11} />}
                  />
                  <TriageButton
                    onClick={() => onTriage(item.id, 'escalated')}
                    disabled={mutatingId === item.id}
                    label="Actualizar reglas"
                    title="Move to 'Pending rule update'. Signals you commit to updating cifra's classifier rules or legal-sources.ts because of this item. (Migration 024 enables Opus 4.7 to auto-draft the code change.)"
                    tone="emerald"
                    icon={<CheckCheckIcon size={11} />}
                  />
                  <TriageButton
                    onClick={() => onTriage(item.id, 'dismissed')}
                    disabled={mutatingId === item.id}
                    label="Descartar"
                    title="Not relevant. Item hides into the Dismissed section (kept for audit). Toggle 'Show dismissed' to recover."
                    tone="muted"
                    icon={<XIcon size={11} />}
                  />
                </>
              )}
              {item.status === 'flagged' && (
                <>
                  <TriageButton
                    onClick={() => onTriage(item.id, 'escalated')}
                    disabled={mutatingId === item.id}
                    label="Actualizar reglas"
                    title="Promote this reminder to a committed rule update."
                    tone="emerald"
                    icon={<CheckCheckIcon size={11} />}
                  />
                  <TriageButton
                    onClick={() => onTriage(item.id, 'dismissed')}
                    disabled={mutatingId === item.id}
                    label="Descartar"
                    title="Decided it's not relevant after all."
                    tone="muted"
                    icon={<XIcon size={11} />}
                  />
                </>
              )}
              {item.status === 'escalated' && (
                <>
                  <TriageButton
                    onClick={() => onTriage(item.id, 'flagged')}
                    disabled={mutatingId === item.id}
                    label="Revertir a recordatorio"
                    title="Send back to Reminders — changed your mind about updating the rules."
                    tone="amber"
                    icon={<BookmarkIcon size={11} />}
                  />
                  <TriageButton
                    onClick={() => onTriage(item.id, 'dismissed')}
                    disabled={mutatingId === item.id}
                    label="Descartar"
                    title="Not worth a rule update after all."
                    tone="muted"
                    icon={<XIcon size={11} />}
                  />
                </>
              )}
              {item.status === 'dismissed' && (
                <TriageButton
                  onClick={() => onTriage(item.id, 'flagged')}
                  disabled={mutatingId === item.id}
                  label="Recuperar"
                  title="Send back to Reminders — you want to revisit this."
                  tone="amber"
                  icon={<BookmarkIcon size={11} />}
                />
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Rendered inside an item when the rule-patch drafter produced a diff.
// Three-button review: Accept (server-side apply via GitHub API) /
// Reject (clears the draft) / Copy command (fallback when
// GITHUB_TOKEN is not configured).
//
// Severity=critical requires the reviewer to tick "I've read the diff"
// before Accept is enabled. Everything else below critical is
// click-through with a second-level confirmation in the client.
function PatchProposalBlock({
  id, diff, reasoning, confidence, targetFiles, appliedAt, commitSha,
  severity, modifiedByHuman, modifiedBy, onReload,
}: {
  id: string;
  diff: string;
  reasoning: string | null;
  confidence: number | null;
  targetFiles: string[] | null;
  appliedAt: string | null;
  commitSha: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | null;
  modifiedByHuman: boolean | null;
  modifiedBy: string | null;
  onReload: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [readChecked, setReadChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSha, setSuccessSha] = useState<string | null>(null);
  // Modify flow (migration 025): user pulls the diff into a textarea,
  // edits, and saves. `draftDiff` holds the working copy; `editing`
  // swaps the read-only <pre> for the textarea and swaps Accept/Reject
  // for Save/Cancel.
  const [editing, setEditing] = useState(false);
  const [draftDiff, setDraftDiff] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  const copyCommand = async () => {
    const cmd = `cd "/Users/gonzalezmansodiego/Desktop/VAT Platform/vat-platform" && git apply <<'PATCH'\n${diff}\nPATCH`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API disabled */
    }
  };

  const accept = async () => {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/legal-watch/queue/${id}/accept-patch`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? `Accept failed (${res.status})`);
        return;
      }
      setSuccessSha(body.commit_sha ?? null);
      // Reload the queue so the item shows applied state and the
      // Accept/Reject UI collapses.
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setAccepting(false);
    }
  };

  const reject = async () => {
    if (!window.confirm('Reject this AI-drafted patch? The item stays in the queue but the draft is discarded. A future scan may produce a new draft.')) {
      return;
    }
    setRejecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/legal-watch/queue/${id}/reject-patch`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? `Reject failed (${res.status})`);
        return;
      }
      await onReload();
    } finally {
      setRejecting(false);
    }
  };

  const startEdit = () => {
    setDraftDiff(diff);
    setEditing(true);
    setError(null);
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraftDiff('');
  };
  const saveEdit = async () => {
    if (!draftDiff.trim()) {
      setError('Diff cannot be empty — use Reject to discard instead.');
      return;
    }
    if (draftDiff.trim() === diff.trim()) {
      // No real change — just leave edit mode quietly.
      cancelEdit();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/legal-watch/queue/${id}/update-patch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diff: draftDiff }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? `Save failed (${res.status})`);
        return;
      }
      setEditing(false);
      setDraftDiff('');
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 4000);
      await onReload();
    } finally {
      setSaving(false);
    }
  };

  const pct = confidence != null ? Math.round(confidence * 100) : null;
  const isCritical = severity === 'critical';
  const acceptDisabled = accepting || rejecting || (isCritical && !readChecked);
  const acceptTooltip = isCritical && !readChecked
    ? 'Critical-severity change — tick "I\'ve read the diff" before accepting.'
    : undefined;

  return (
    <div className="mt-2 rounded border border-emerald-300 bg-emerald-50/60 px-2.5 py-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 text-left"
      >
        {open ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
        <span className="text-2xs font-semibold text-emerald-800 uppercase tracking-wide flex items-center gap-1">
          <SparklesIcon size={10} />
          AI-proposed rule patch
        </span>
        {pct != null && (
          <span className="text-2xs text-emerald-700 font-normal">· confidence {pct}%</span>
        )}
        {modifiedByHuman && !appliedAt && !successSha && (
          <span
            className="text-2xs text-amber-800 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5 font-medium"
            title={`Reviewer${modifiedBy ? ` (${modifiedBy})` : ''} edited the drafter's diff. The original is preserved in the audit log.`}
          >
            Edited by reviewer
          </span>
        )}
        {(appliedAt || successSha) && (
          <span className="text-2xs text-emerald-700 font-normal">
            · applied {(commitSha || successSha) ? `(${(commitSha || successSha)!.slice(0, 7)})` : ''}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-2">
          {reasoning && (
            <p className="text-xs text-ink leading-relaxed mb-2 whitespace-pre-wrap">
              {reasoning}
            </p>
          )}
          {targetFiles && targetFiles.length > 0 && (
            <div className="mb-2 text-2xs text-ink-soft">
              <strong className="font-semibold">Target files:</strong>{' '}
              {targetFiles.map((f, i) => (
                <code key={i} className="text-2xs bg-white px-1 rounded mr-1">{f}</code>
              ))}
            </div>
          )}
          {editing ? (
            <textarea
              value={draftDiff}
              onChange={e => setDraftDiff(e.target.value)}
              spellCheck={false}
              className="w-full text-2xs font-mono bg-white border border-amber-300 rounded p-2 min-h-[240px] max-h-[480px] resize-y focus:ring-2 focus:ring-amber-400"
              placeholder="Edit the unified diff. Only these files are allowed: src/config/classification-rules.ts, src/config/legal-sources.ts, src/config/exemption-keywords.ts, src/__tests__/fixtures/synthetic-corpus.ts"
            />
          ) : (
            <pre className="text-2xs font-mono bg-white border border-emerald-200 rounded p-2 overflow-x-auto max-h-[320px] overflow-y-auto">
              {diff.split('\n').map((line, i) => {
                const colour = line.startsWith('+++') || line.startsWith('---')
                  ? 'text-ink-muted font-semibold'
                  : line.startsWith('+')
                    ? 'text-emerald-700 bg-emerald-50'
                    : line.startsWith('-')
                      ? 'text-red-700 bg-red-50'
                      : line.startsWith('@@')
                        ? 'text-violet-700'
                        : 'text-ink';
                return <div key={i} className={colour}>{line || '\u00A0'}</div>;
              })}
            </pre>
          )}
          {savedBanner && (
            <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              Diff updated — the original AI draft is preserved in the audit log. Tests are now stale; Accept will commit without fresh test evidence.
            </div>
          )}

          {error && (
            <div className="mt-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {error}
              {error.includes('GITHUB_TOKEN') && (
                <div className="mt-1 text-2xs text-red-700">
                  Fallback: copy the git-apply command and paste it in your terminal.
                </div>
              )}
            </div>
          )}

          {!appliedAt && !successSha && (
            <div className="mt-2 space-y-2">
              {isCritical && (
                <label className="flex items-center gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={readChecked}
                    onChange={e => setReadChecked(e.target.checked)}
                    className="h-3.5 w-3.5 accent-red-600"
                  />
                  <span>
                    <strong className="font-semibold">Critical change</strong> — I&apos;ve read the diff and accept responsibility for this rule update.
                  </span>
                </label>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {editing ? (
                  <>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {saving ? <Loader2Icon size={11} className="animate-spin" /> : <CheckCheckIcon size={11} />}
                      {saving ? 'Saving…' : 'Save edits'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded border border-border text-xs text-ink-soft hover:bg-surface-alt hover:text-ink hover:border-border-strong transition-colors disabled:opacity-40"
                    >
                      <XIcon size={11} />
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={accept}
                      disabled={acceptDisabled}
                      title={acceptTooltip}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {accepting ? <Loader2Icon size={11} className="animate-spin" /> : <CheckCheckIcon size={11} />}
                      {accepting ? 'Committing…' : 'Accept & commit'}
                    </button>
                    <button
                      onClick={startEdit}
                      disabled={accepting || rejecting}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded border border-amber-300 text-xs text-amber-800 hover:bg-amber-50 hover:border-amber-400 transition-colors disabled:opacity-40"
                      title="Open the diff in an editable textarea. The original AI draft is preserved in the audit log."
                    >
                      <PencilIcon size={11} />
                      Modificar
                    </button>
                    <button
                      onClick={reject}
                      disabled={accepting || rejecting}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded border border-border text-xs text-ink-soft hover:bg-surface-alt hover:text-ink hover:border-border-strong transition-colors disabled:opacity-40"
                    >
                      <XIcon size={11} />
                      {rejecting ? 'Rejecting…' : 'Reject'}
                    </button>
                    <button
                      onClick={copyCommand}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded border border-border text-xs text-ink-soft hover:bg-surface-alt hover:text-ink hover:border-border-strong transition-colors"
                      title="Fallback: copy the git-apply command to run locally if the Accept button is blocked (e.g. GITHUB_TOKEN not configured in Vercel env)."
                    >
                      <BookmarkIcon size={11} />
                      {copied ? 'Copied ✓' : 'Copy git apply command'}
                    </button>
                  </>
                )}
              </div>
              <div className="text-2xs text-ink-muted italic">
                Accept uses the GitHub API to commit the diff to main with a signed <code className="bg-white px-1 rounded">ai_drafted=true</code> attribution. When edited, the commit also carries <code className="bg-white px-1 rounded">human_edited: true</code>. Vercel auto-deploys.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TriageButton({
  onClick, disabled, label, title, tone, icon,
}: {
  onClick: () => void; disabled: boolean; label: string; title: string;
  tone: 'amber' | 'emerald' | 'muted';
  icon: React.ReactNode;
}) {
  const tones = {
    amber: 'hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200',
    emerald: 'hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200',
    muted: 'hover:bg-surface-alt hover:text-ink hover:border-border-strong',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border text-xs text-ink-soft transition-colors whitespace-nowrap ${tones[tone]} disabled:opacity-40 disabled:cursor-wait`}
    >
      {icon}
      {label}
    </button>
  );
}
