# cifra · Design System

> **Source of truth.** Every UI decision in cifra — colour, type, spacing,
> primitive — lives here. If you find yourself writing `text-[12.5px]`
> or `border-[#1a1a2e]` in a component, **stop and consult this doc**.
> Tokens cover every reasonable need; ad-hoc literals fragment the look
> across modules.
>
> Diego's directive (2026-04-26): "El diseño tiene que ser uniforme a
> través de cifra. En todos los distintos módulos." — VAT, Tax-Ops, CRM,
> Settings, Marketing, future Peppol/ViDA. One look, everywhere.

---

## 1 · Tokens

All tokens live in `src/app/globals.css` (`:root` for raw values,
`@theme inline` for Tailwind 4 utility bindings).

### 1.1 Colour

| Token            | Tailwind class             | CSS var                  | Use |
|------------------|----------------------------|--------------------------|-----|
| Brand 50–900     | `bg-brand-{tier}` etc.     | `--color-brand-{tier}`   | CTA, focus, links, logo accents |
| Canvas           | `bg-canvas`                | `--color-canvas`         | Page background |
| Surface          | `bg-surface`               | `--color-surface`        | Cards, panels, drawer body |
| Surface alt      | `bg-surface-alt`           | `--color-surface-alt`    | Subtle fills, table-header bg, hover |
| Border           | `border-border`            | `--color-border`         | Default border |
| Border strong    | `border-border-strong`     | `--color-border-strong`  | Emphasis-only border |
| Divider          | `border-divider`           | `--color-divider`        | Sub-cards, very subtle |
| Ink              | `text-ink`                 | `--color-ink`            | Primary text |
| Ink soft         | `text-ink-soft`            | `--color-ink-soft`       | Secondary text |
| Ink muted        | `text-ink-muted`           | `--color-ink-muted`      | Tertiary, captions |
| Ink faint        | `text-ink-faint`           | `--color-ink-faint`      | Placeholder, disabled |
| Success 50/500/700 | `text-success-{tier}` …  | `--color-success-{tier}` | Confirmation, paid, aligned |
| Warning 50/500/700 | `text-warning-{tier}` …  | `--color-warning-{tier}` | Pending, info-to-request |
| Danger  50/500/700 | `text-danger-{tier}` …   | `--color-danger-{tier}`  | Errors, overdue, destructive |
| Info    50/500/700 | `text-info-{tier}` …     | `--color-info-{tier}`    | Informational, drag-over |

**Custom tones for badges** (violet/teal/amber/indigo/fuchsia/sky) ride on
Tailwind 4's stock palette via `bg-{tone}-100 text-{tone}-700 border-{tone}-200`.
They're orthogonal to brand and shouldn't appear elsewhere.

**Forbidden**: hex literals in `className` (`border-[#1a1a2e]` etc.).
The palette covers every shade we use; if you need a new tone, add a
new token, don't hardcode.

### 1.2 Type scale

| Tailwind class | px    | line-height | Use |
|----------------|-------|-------------|-----|
| `text-2xs`     | 10    | 14          | Captions, table-header uppercase, dense chips |
| `text-xs`      | 11    | 16          | Small chips, badges, footer text, secondary metadata |
| `text-sm`      | 12.5  | 18          | **Body text · table cells · inline editors (canonical)** |
| `text-base`    | 14    | 20          | CTAs, form labels, drawer titles |
| `text-lg`      | 18    | 24          | h3 section headings |
| `text-xl`      | 22    | 28          | h2 page subheadings · `<PageHeader variant="default">` |
| `text-2xl`     | 26    | 32          | h1 standard page title · `<PageHeader variant="hero">` |
| `text-3xl`     | 32    | 40          | Hero h1 (rare; landing only) |

**Forbidden**: `text-[Xpx]` literal sizes. A handful of display-tier
KPI cards use 34/44/68 px and have a TODO to fold into a future
`text-display-*` tier; do not add new ones.

**Numerics**: anything that's a count / EUR amount / tabular code uses
`tabular-nums`. Pair with `font-mono` only for VAT numbers + matricule
codes where character alignment matters.

### 1.3 Spacing rhythm

Stack utilities map onto semantic scales:

| Tailwind          | rem | px  | Use |
|-------------------|-----|-----|-----|
| `space-y-1`       | 0.25 | 4  | Inline chip groups |
| `space-y-2`       | 0.5  | 8  | List items inside a card |
| `space-y-3`       | 0.75 | 12 | Dense matrix root spacing |
| `space-y-4`       | 1    | 16 | **Page root spacing (canonical)** |
| `space-y-6`       | 1.5  | 24 | Separated panels |
| `space-y-8`       | 2    | 32 | Page-level hero sections |

Page root: `<div className="space-y-4">` unless the page is a high-density
matrix (then `space-y-3`).

### 1.4 Border radius

| Tailwind    | px  | Use |
|-------------|-----|-----|
| `rounded-xs`   | 4  | Tiny chips |
| `rounded-sm`   | 6  | Badges, micro buttons |
| `rounded`      | 6  | Default (= sm in cifra) |
| `rounded-md`   | 8  | Cards, drawers, primary buttons |
| `rounded-lg`   | 12 | Large cards, KPI tiles |
| `rounded-xl`   | 16 | Hero / banner blocks |
| `rounded-full` | —  | Avatars, dot indicators |

### 1.5 Shadow / elevation

| Tailwind        | Use |
|-----------------|-----|
| `shadow-xs`     | Buttons, subtle lifts |
| `shadow-sm`     | Hover lift on cards |
| `shadow-md`     | Modals, dropdowns |
| `shadow-lg`     | Drawers, popover panels |
| `shadow-focus`  | Focus halo (auto-applied via `globals.css`) |

### 1.6 Focus

`globals.css` owns the canonical halo. Every interactive element
(button / a / input / select / textarea / `[tabindex]`) automatically gets
`box-shadow: var(--shadow-focus)` on `:focus-visible`. **Never re-add**
`focus:outline-none` + `focus:ring-{...}` on individual components — the
global rule handles it. Exceptions (legitimate per-component focus tints)
are documented inline.

---

## 2 · Layout primitives

| Component         | Path                                          | Use when |
|-------------------|-----------------------------------------------|----------|
| `<PageContainer>` | `src/components/ui/PageContainer.tsx`         | Wraps every page. `width="wide"` (default, max-w-7xl) for matrix/dashboards, `medium` (5xl) for lists, `narrow` (3xl) for forms. |
| `<PageHeader>`    | `src/components/ui/PageHeader.tsx`            | Title + subtitle + actions + breadcrumb. `variant="default" \| "hero" \| "compact"`. |
| `<Card>`          | `src/components/ui/Card.tsx`                  | Generic card wrapper (rounded-md border bg-surface). Use for any panel that's not a Drawer/Modal. |
| `<Drawer>`        | `src/components/ui/Drawer.tsx`                | Right-side slide-in panel. Replaces ad-hoc panels in FilingEditDrawer / EntityEditCard / BulkEditModal. |
| `<Modal>`         | `src/components/ui/Modal.tsx`                 | Centred dialog. Use for confirms, short forms, irreversible actions. |
| `<Popover>`       | `src/components/ui/Popover.tsx`               | Floating panel anchored to a trigger. For dropdowns, date pickers, action menus. |

---

## 3 · Form primitives

| Component         | Path                                          | Use when |
|-------------------|-----------------------------------------------|----------|
| `<Field>`         | `src/components/ui/Field.tsx`                 | Wraps any input with label + hint/error in canonical spacing. |
| `<Input>`         | `src/components/ui/Input.tsx`                 | Text / number / email / password inputs. |
| `<Textarea>`      | exported from `Input.tsx`                     | Multi-line text. |
| `<Select>`        | exported from `Input.tsx`                     | Native dropdown (≤10 options). |
| `<SearchableSelect>` | `src/components/ui/SearchableSelect.tsx`   | Combobox with type-to-filter. Use when option list could grow >10. |
| `<Button>`        | `src/components/ui/Button.tsx`                | All buttons. `variant="primary" \| "secondary" \| "ghost" \| "danger" \| "success"`, `size="sm" \| "md" \| "lg"`. |

**Never** roll a raw `<button className="bg-brand-500 …">` in feature code.
If `<Button>` doesn't fit, add a variant to `<Button>` first, then use it.

---

## 4 · Data display

| Component          | Path                                   | Use when |
|--------------------|----------------------------------------|----------|
| `<DataTable>`      | `src/components/ui/DataTable.tsx`      | Vanilla list tables (home portfolio, declarations list, entities list, clients). |
| `<TaxTypeMatrix>`  | `src/components/tax-ops/TaxTypeMatrix.tsx` | Excel-grade matrix (CIT/VAT/WHT/etc.). NOT generic — keep specialized. |
| `<Badge>`          | `src/components/ui/Badge.tsx`          | Status / category chip. 12 tones, 2 sizes. |
| `<Stat>`           | `src/components/ui/Stat.tsx`           | KPI card (label + value + tone). |
| `<EmptyState>`     | `src/components/ui/EmptyState.tsx`     | When a list/table has no rows. 7 inline-SVG illustrations. |
| `<Skeleton>`       | `src/components/ui/Skeleton.tsx`       | Loading state. Variants `Skeleton`, `SkeletonText`, `SkeletonRow`, `PageSkeleton`. |

---

## 5 · Feedback

| Component         | Path                                          | Use when |
|-------------------|-----------------------------------------------|----------|
| `useToast()`      | `src/components/Toaster.tsx`                  | Transient confirmations / errors. Single source via `<ToastProvider>`. |
| `<CrmErrorBox>`   | `src/components/crm/CrmErrorBox.tsx`          | Inline error block (page-level). |
| `<Tabs>`          | `src/components/ui/Tabs.tsx`                  | Tab navigation. |
| `<Breadcrumbs>`   | `src/components/ui/Breadcrumbs.tsx`           | Page hierarchy. |
| `<LifecycleStepper>` | `src/components/ui/LifecycleStepper.tsx`   | Multi-step state visualisation. |

---

## 6 · Cross-module rules

These apply to EVERY module — Tax-Ops, VAT, CRM, Settings, Marketing,
future Peppol/ViDA, future Direct-Tax.

1. **One look, one feel.** A user navigating from `/declarations` →
   `/crm/companies` → `/tax-ops/cit` should not perceive style shifts.
   Same h1 size, same card padding, same hover opacity (`/50`), same
   button height (h-8 md / h-9 lg), same focus halo.

2. **Container width canon**: every page roots at `<PageContainer>`.
   `wide` for matrices/dashboards, `medium` for lists, `narrow` for
   forms. Never `max-w-[1234px]` ad-hoc.

3. **Header canon**: every page opens with `<PageHeader>`. Title +
   optional subtitle + optional actions slot. `variant="hero"` only on
   the home dashboard; everything else uses the default.

4. **Type scale canon**: `text-{2xs|xs|sm|base|lg|xl|2xl|3xl}`. No
   `text-[Xpx]` literals.

5. **Token-only colours**: every colour utility traces back to a token
   in `globals.css`. No hex in `className`.

6. **Hover canon**: row/card hovers use `hover:bg-surface-alt/50`
   uniformly. No `/40` or `/60` divergent values.

7. **Forms canon**: every form field wraps in `<Field>`; controls
   are `<Input>` / `<Select>` / `<Textarea>` / `<SearchableSelect>`;
   buttons are `<Button>`. No raw Tailwind primary CTAs.

8. **Tables canon**: vanilla lists use `<DataTable>`; tax-ops matrices
   use `<TaxTypeMatrix>`; never a third pattern.

9. **Drawers vs Modals**: editing existing entity → `<Drawer>`. Brief
   confirmation → `<Modal>`. Page-level navigation → in-page section.
   Never roll a custom right-panel.

10. **Focus canon**: `globals.css` owns it. Don't re-decorate.

---

## 7 · Adding a new module / page

Checklist when creating a new section of cifra:

- [ ] Page wraps `<PageContainer width="…">`.
- [ ] Page opens with `<PageHeader title="…" subtitle="…" actions={…} />`.
- [ ] Page-root spacing is `space-y-4` (or `space-y-3` for dense matrices).
- [ ] Lists use `<DataTable>` or `<TaxTypeMatrix>`. Never raw `<table>`.
- [ ] Forms use `<Field>` wrapping `<Input>` / `<Select>` / `<Textarea>`.
- [ ] CTAs use `<Button>`. Never raw Tailwind primary buttons.
- [ ] Drawers use `<Drawer>`. Popovers use `<Popover>`.
- [ ] Status chips use `<Badge>` with semantic tones.
- [ ] Toasts use `useToast()`.
- [ ] Empty states use `<EmptyState>`.
- [ ] Loading states use `<Skeleton>` variants.
- [ ] Zero `text-[Xpx]`. Zero `border-[#hex]`. Zero `focus:ring-1`.

If any of these doesn't fit, the answer is to **extend the primitive,
not to escape it**. Add a variant, document it here, then use it.

---

## 8 · Forbidden patterns (CI-enforced from stint 47)

A pre-commit / CI check will fail on:

- `text-\[\d+(\.\d+)?px\]` — bypasses type scale.
- `border-\[#[0-9A-Fa-f]+\]` — bypasses colour tokens.
- `bg-\[#[0-9A-Fa-f]+\]` — same.
- `hover:bg-surface-alt\/(?!50)` — divergent hover opacity.
- Raw `focus:ring-1 focus:ring-brand-500` — duplicates the global halo.

Run `npm run lint:design` locally to catch before push.

---

## 9 · Roadmap

- [ ] Display-tier text tokens for KPI hero numbers (34/44/68 px).
- [ ] `<Field layout="grid">` for 2-column form layouts.
- [ ] Dark mode (currently parked; see `CLAUDE.md` §8).
- [ ] Mobile / responsive (parked).
- [ ] Storybook (overkill for single-tenant today).

---

## 10 · Stint history

- **45.F1** (2026-04-26) — type scale tokens · PageHeader variants ·
  PageContainer · hover canon · hex purge.
- **46.F2** (2026-04-26) — DataTable · Field · Button standardisation ·
  155-file bulk text-scale migration · focus state unification.
- **47.F3** (2026-04-26) — Drawer · Popover · spacing/radii tokens ·
  this doc · CI lint rules.
