'use client';

// Per-row delete icon for matrix pages — soft-archives the obligation
// so the row disappears from THIS matrix but historical filings stay
// intact (they still appear on the entity detail page). Reversible.

import { useState } from 'react';
import { Trash2Icon } from 'lucide-react';
import { useToast } from '@/components/Toaster';

export function RemoveRowButton({
  obligationId, entityName, onRemoved,
}: {
  obligationId: string | null;
  entityName: string;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (!obligationId) {
    return null;
  }

  async function handle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm(`Remove "${entityName}" from this view? The obligation will be archived (reversible); historical filings stay on the entity detail page.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/tax-ops/obligations/${obligationId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Removed');
      onRemoved();
    } catch (err) {
      toast.error(`Remove failed: ${String(err instanceof Error ? err.message : err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      title={`Archive "${entityName}" from this obligation`}
      aria-label="Remove row"
      className="p-1 text-ink-muted hover:text-danger-600 disabled:opacity-50"
    >
      <Trash2Icon size={12} />
    </button>
  );
}
