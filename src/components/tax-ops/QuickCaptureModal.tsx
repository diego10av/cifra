'use client';

// QuickCaptureModal — press `N` anywhere under /tax-ops to open.
// Minimal inputs: title + optional due date + priority. Press Enter
// to create. Enhancement in 35: natural-language date parser + AI
// paste-and-extract.

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/Toaster';

export function QuickCaptureModal() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only listen under /tax-ops; other modules have their own shortcuts.
    if (!pathname.startsWith('/tax-ops')) return;
    function handler(e: KeyboardEvent) {
      // Ignore if user is typing in an input already
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pathname]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else {
      setTitle(''); setDue(''); setPriority('medium'); setBusy(false);
    }
  }, [open]);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/tax-ops/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          due_date: due || null,
          priority,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { id: string };
      toast.success('Task created');
      setOpen(false);
      router.push(`/tax-ops/tasks/${body.id}`);
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="New task"
      subtitle="Press N from any /tax-ops page. Enter to create, Esc to cancel."
      size="md"
    >
      <div className="space-y-3 text-[12.5px]">
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !busy) submit(); }}
          placeholder="What needs to happen?"
          className="w-full px-2.5 py-2 border border-border rounded-md bg-surface text-[13px]"
        />
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="text-ink-muted">Due date</span>
            <input
              type="date"
              value={due}
              onChange={e => setDue(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface"
            />
          </label>
          <label>
            <span className="text-ink-muted">Priority</span>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as typeof priority)}
              className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-[12.5px] rounded-md border border-border hover:bg-surface-alt"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !title.trim()}
            className="px-3 py-1.5 text-[12.5px] rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
