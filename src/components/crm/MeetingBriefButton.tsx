'use client';

// ════════════════════════════════════════════════════════════════════════
// MeetingBriefButton — click to generate a 1-page AI meeting prep
// brief for this contact via Opus 4.7. Shown in a modal as rendered
// markdown (simple div with whitespace-pre-wrap — no markdown parser
// dependency for now; the brief text reads fine as plain text).
// ════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { SparklesIcon, CopyIcon, DownloadIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/Toaster';

export function MeetingBriefButton({
  contactId, contactName,
}: {
  contactId: string;
  contactName: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setBrief(null);
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}/meeting-prep`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error?.message ?? 'Brief generation failed');
        setOpen(false);
        return;
      }
      const body = await res.json();
      setBrief(body.brief_markdown ?? '');
    } finally { setLoading(false); }
  }

  function open_and_generate() {
    setOpen(true);
    generate();
  }

  function copyToClipboard() {
    if (!brief) return;
    navigator.clipboard.writeText(brief).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Copy failed'),
    );
  }

  function download() {
    if (!brief) return;
    const blob = new Blob([brief], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-brief-${contactName.replace(/[^a-zA-Z0-9]+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button
        onClick={open_and_generate}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-brand-300 bg-brand-50 text-sm font-medium text-brand-700 hover:bg-brand-100"
        title="AI-generated 1-page meeting prep brief"
      >
        <SparklesIcon size={13} />
        Meeting brief
      </button>
      {open && (
        <Modal
          open={true}
          onClose={() => !loading && setOpen(false)}
          title={`Meeting brief — ${contactName}`}
          size="lg"
          footer={
            brief ? (
              <div className="flex items-center gap-2 justify-end">
                <button onClick={copyToClipboard} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-white text-sm text-ink-soft hover:bg-surface-alt">
                  <CopyIcon size={12} />
                  Copy
                </button>
                <button onClick={download} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-white text-sm text-ink-soft hover:bg-surface-alt">
                  <DownloadIcon size={12} />
                  Download .md
                </button>
                <Button variant="primary" size="sm" onClick={generate} loading={loading}>Regenerate</Button>
              </div>
            ) : null
          }
        >
          {loading && (
            <div className="text-sm text-ink-muted italic py-8 text-center">
              Opus 4.7 is reading the file. Typically 10-20 seconds…
            </div>
          )}
          {brief && (
            <div className="text-sm leading-relaxed text-ink whitespace-pre-wrap font-[ui-sans-serif]">{brief}</div>
          )}
        </Modal>
      )}
    </>
  );
}
