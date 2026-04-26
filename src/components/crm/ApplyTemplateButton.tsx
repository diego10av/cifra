'use client';

// ════════════════════════════════════════════════════════════════════════
// ApplyTemplateButton — loads task templates matching the given scope
// and presents a picker. On select, POSTs to /apply and toasts the
// count of tasks created.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { BookOpenCheckIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/Toaster';

interface Template {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  items: Array<{ title: string; due_offset_days?: number; priority?: string }>;
}

export function ApplyTemplateButton({
  scope, targetType, targetId,
}: {
  scope: 'matter' | 'company' | 'contact';
  targetType: 'crm_matter' | 'crm_company' | 'crm_contact';
  targetId: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    if (!open || templates !== null) return;
    fetch(`/api/crm/task-templates?scope=${scope}`, { cache: 'no-store' })
      .then(r => r.json()).then(setTemplates).catch(() => setTemplates([]));
  }, [open, templates, scope]);

  async function apply(id: string) {
    setApplying(id);
    try {
      const res = await fetch(`/api/crm/task-templates/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId }),
      });
      if (!res.ok) { toast.error('Apply failed'); return; }
      const body = await res.json();
      toast.success(`${body.tasks_created} tasks created from "${body.template_name}"`);
      setOpen(false);
    } finally { setApplying(null); }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-white text-sm font-medium text-ink-soft hover:bg-surface-alt"
        title="Apply a task template — creates N tasks at once"
      >
        <BookOpenCheckIcon size={13} />
        Apply template
      </button>
      {open && (
        <Modal
          open={true}
          onClose={() => !applying && setOpen(false)}
          title="Apply task template"
          size="lg"
        >
          {templates === null ? (
            <div className="text-sm text-ink-muted italic py-6 text-center">Loading…</div>
          ) : templates.length === 0 ? (
            <div className="text-sm text-ink-muted italic py-6 text-center">No templates for this scope.</div>
          ) : (
            <ul className="space-y-2">
              {templates.map(t => (
                <li key={t.id} className="border border-border rounded-md p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-ink-muted mt-0.5">{t.description}</div>
                      )}
                      <div className="text-2xs text-ink-muted mt-1">
                        Creates {t.items.length} task{t.items.length === 1 ? '' : 's'}: {t.items.slice(0, 3).map(i => i.title).join(' · ')}{t.items.length > 3 ? ` · +${t.items.length - 3} more` : ''}
                      </div>
                    </div>
                    <Button variant="primary" size="sm" loading={applying === t.id} onClick={() => apply(t.id)}>
                      Apply
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </>
  );
}
