'use client';

// ════════════════════════════════════════════════════════════════════════
// Portal page — the public face of a pending declaration approval.
//
// Flow: link lands here → fetch /api/portal/[token] → render summary
// with one big Approve button → on click, POST /api/portal/[token]/approve
// → show confirmation. No login, no sidebar, no operator chrome.
//
// Token invalid / expired / already-approved states each render their
// own message so the client knows what went wrong without needing to
// guess or contact support.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2Icon, AlertCircleIcon, ShieldCheckIcon, Loader2Icon, FileTextIcon } from 'lucide-react';
import { Logo } from '@/components/Logo';

interface PortalData {
  token_valid: true;
  expires_at_unix: number;
  declaration: {
    id: string;
    year: number;
    period: string;
    status: string;
    entity_name: string;
    vat_number: string | null;
    matricule: string | null;
  };
  summary: {
    line_count: number;
    total_ex_vat: number;
    total_vat: number;
  };
  already_approved_via_portal: boolean;
  approved_at: string | null;
}

function fmtEUR(v: number): string {
  return v.toLocaleString('en-LU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPeriod(year: number, period: string): string {
  if (period === 'Y1') return `Annual ${year}`;
  if (/^Q[1-4]$/i.test(period)) return `${period.toUpperCase()} ${year}`;
  if (/^\d{1,2}$/.test(period)) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = parseInt(period, 10) - 1;
    const name = monthNames[idx] || period;
    return `${name} ${year}`;
  }
  return `${year} ${period}`;
}

export default function PortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<PortalData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  const loadPortal = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setLoadErrorCode(null);
    try {
      const res = await fetch(`/api/portal/${token}`);
      const body = await res.json();
      if (!res.ok) {
        setLoadErrorCode(body?.error?.code ?? 'unknown');
        setLoadError(body?.error?.message ?? 'This link cannot be opened.');
        return;
      }
      setData(body as PortalData);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  async function approve() {
    if (approving || approved) return;
    setApproving(true);
    setApproveError(null);
    try {
      const res = await fetch(`/api/portal/${token}/approve`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setApproveError(body?.error?.message ?? 'Approval failed. Please try again.');
        return;
      }
      setApproved(true);
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-alt flex flex-col">
      <Header />
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-[560px]">
          {loading && <LoadingCard />}

          {!loading && loadError && (
            <ErrorCard
              code={loadErrorCode}
              message={loadError}
            />
          )}

          {!loading && data && !loadError && (
            <SuccessCard
              data={data}
              approved={approved || data.already_approved_via_portal}
              previouslyApprovedAt={data.approved_at}
              approving={approving}
              approveError={approveError}
              onApprove={approve}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ─────────────────────────── subcomponents ───────────────────────────

function Header() {
  return (
    <header className="h-14 px-4 flex items-center border-b border-divider bg-surface">
      <Logo />
    </header>
  );
}

function Footer() {
  return (
    <footer className="py-5 px-4 text-center text-[11px] text-ink-faint border-t border-divider bg-surface">
      This is a secure approval link from cifra. It expires after a short
      period. Do not forward.
    </footer>
  );
}

function LoadingCard() {
  return (
    <div className="bg-surface border border-border rounded-xl p-8 shadow-sm flex items-center gap-3 text-[13px] text-ink-muted">
      <Loader2Icon size={16} className="animate-spin" />
      Validating your approval link…
    </div>
  );
}

function ErrorCard({ code, message }: { code: string | null; message: string }) {
  return (
    <div className="bg-surface border border-danger-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-danger-50 text-danger-700 inline-flex items-center justify-center shrink-0">
          <AlertCircleIcon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-semibold text-ink tracking-tight">Link unavailable</h1>
          <p className="text-[13px] text-ink-soft mt-1.5 leading-relaxed">{message}</p>
          {code && (
            <p className="text-[11px] text-ink-muted mt-3 font-mono">error: {code}</p>
          )}
          <p className="text-[12px] text-ink-muted mt-3">
            Please reach out to the sender to request a fresh link.
          </p>
        </div>
      </div>
    </div>
  );
}

function SuccessCard({
  data, approved, previouslyApprovedAt, approving, approveError, onApprove,
}: {
  data: PortalData;
  approved: boolean;
  previouslyApprovedAt: string | null;
  approving: boolean;
  approveError: string | null;
  onApprove: () => void;
}) {
  const { declaration, summary } = data;
  const expires = new Date(data.expires_at_unix * 1000);
  const expiresStr = expires.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-6 py-5 border-b border-divider bg-surface">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-ink-muted">
          <FileTextIcon size={12} />
          VAT declaration approval
        </div>
        <h1 className="text-[20px] font-semibold text-ink tracking-tight mt-2">
          {declaration.entity_name}
        </h1>
        <div className="text-[13px] text-ink-muted mt-1">
          {fmtPeriod(declaration.year, declaration.period)}
          {declaration.vat_number && <> · <span className="font-mono">{declaration.vat_number}</span></>}
        </div>
      </div>

      {/* Summary numbers */}
      <div className="grid grid-cols-3 divide-x divide-divider border-b border-divider">
        <Stat label="Invoice lines" value={summary.line_count.toString()} />
        <Stat label="Total ex-VAT" value={`€${fmtEUR(summary.total_ex_vat)}`} />
        <Stat
          label="VAT payable"
          value={`€${fmtEUR(summary.total_vat)}`}
          emphasise
        />
      </div>

      {/* Approval action */}
      <div className="px-6 py-5">
        {approved ? (
          <ApprovedState previouslyApprovedAt={previouslyApprovedAt} />
        ) : (
          <>
            <p className="text-[13px] text-ink-soft leading-relaxed">
              By approving, you confirm the amounts above and authorise cifra to
              submit this declaration to the Luxembourg tax administration (AED)
              on your behalf.
            </p>
            <p className="text-[11.5px] text-ink-muted mt-2.5">
              This approval is recorded with a timestamp and your IP address.
              The link expires on <span className="font-medium">{expiresStr}</span>.
            </p>
            <button
              onClick={onApprove}
              disabled={approving}
              className="mt-5 w-full h-11 rounded-lg bg-brand-500 text-white text-[14px] font-semibold hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
            >
              {approving ? (
                <>
                  <Loader2Icon size={15} className="animate-spin" /> Recording approval…
                </>
              ) : (
                <>
                  <ShieldCheckIcon size={15} /> Approve declaration
                </>
              )}
            </button>
            {approveError && (
              <p className="mt-3 text-[12px] text-danger-700 bg-danger-50 border border-danger-200 rounded px-3 py-2">
                {approveError}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ApprovedState({ previouslyApprovedAt }: { previouslyApprovedAt: string | null }) {
  const when = previouslyApprovedAt
    ? new Date(previouslyApprovedAt).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : 'just now';

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-emerald-500 text-white inline-flex items-center justify-center shrink-0">
        <CheckCircle2Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-emerald-900">
          Declaration approved
        </div>
        <div className="text-[12.5px] text-emerald-800 mt-1 leading-relaxed">
          Approved {when}. cifra will now proceed with the filing. You can
          close this page.
        </div>
      </div>
    </div>
  );
}

function Stat({
  label, value, emphasise,
}: { label: string; value: string; emphasise?: boolean }) {
  return (
    <div className="px-4 py-4">
      <div className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-muted">{label}</div>
      <div
        className={[
          'mt-1 tabular-nums',
          emphasise ? 'text-[18px] font-bold text-ink' : 'text-[15px] font-semibold text-ink',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  );
}
