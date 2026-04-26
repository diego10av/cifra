'use client';

// ════════════════════════════════════════════════════════════════════════
// Field — stint 45.F2.3
//
// Form-field wrapper that bundles the canonical label + control + hint +
// error pattern. Diego sees one input style + one label style across
// every form. Replaces ~30 ad-hoc forms each rolling their own spacing.
//
// Use:
//   <Field label="Legal name" hint="As registered in RCS" error={errors.legalName}>
//     <Input name="legalName" value={...} onChange={...} />
//   </Field>
//
// The Field doesn't render the input itself — it owns label/hint/error
// and lays them out with the canon spacing. This keeps it composable
// with Input, Select, Textarea, SearchableSelect, custom date pickers,
// inline tags cells, etc.
// ════════════════════════════════════════════════════════════════════════

import { type ReactNode, useId } from 'react';

interface Props {
  label: ReactNode;
  /** Help text shown below the input in muted ink. */
  hint?: ReactNode;
  /** Error text shown below the input in danger tone (replaces hint). */
  error?: ReactNode;
  /** Content of the field (Input / Select / Textarea / custom). The
   *  child receives an `id` injected via the `htmlFor` attr — pass it
   *  through to your input so the label clicks focus correctly. */
  children: ReactNode;
  /** Required marker ("*") next to the label. */
  required?: boolean;
  /** Render label above (default) or to the left (horizontal forms). */
  layout?: 'stacked' | 'inline';
  /** Optional ID — auto-generated if not provided. */
  id?: string;
  className?: string;
}

export function Field({
  label, hint, error, children, required, layout = 'stacked', id, className = '',
}: Props) {
  const auto = useId();
  const fieldId = id ?? auto;

  if (layout === 'inline') {
    return (
      <div className={['grid grid-cols-[140px_1fr] gap-3 items-center', className].join(' ')}>
        <label
          htmlFor={fieldId}
          className="text-sm font-medium text-ink-soft text-right"
        >
          {label}
          {required && <span className="text-danger-500 ml-0.5" aria-hidden>*</span>}
        </label>
        <div>
          {children}
          {(hint || error) && (
            <div
              className={['mt-1 text-xs', error ? 'text-danger-700' : 'text-ink-muted'].join(' ')}
              role={error ? 'alert' : undefined}
              id={`${fieldId}-help`}
            >
              {error ?? hint}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={['flex flex-col gap-1.5', className].join(' ')}>
      <label
        htmlFor={fieldId}
        className="text-sm font-medium text-ink-soft"
      >
        {label}
        {required && <span className="text-danger-500 ml-0.5" aria-hidden>*</span>}
      </label>
      {children}
      {(hint || error) && (
        <div
          className={['text-xs', error ? 'text-danger-700' : 'text-ink-muted'].join(' ')}
          role={error ? 'alert' : undefined}
          id={`${fieldId}-help`}
        >
          {error ?? hint}
        </div>
      )}
    </div>
  );
}
