# cifra · TODO

> Tareas concretas de esta semana. Diego dogfoodea; cifra le hace su
> trabajo más eficiente. Cuando algo se rompa al usar, lo escribimos
> aquí. Cuando algo se arregle, se mueve a "Done this week" → archivo
> los lunes.
>
> Last updated: **2026-05-05** (post-reset).

---

## 🔥 Esta semana

### Diego — manuales (3 clicks de Vercel + 0 más)

- [ ] **Vercel env vars** (3 minutos):
  - Settings → Environment Variables.
  - **Añadir**: `ADMIN_PASSWORD` con un string ≥ 12 chars.
  - **Borrar**: `AUTH_USERS`, `AUTH_PASS_DIEGO` y cualquier `AUTH_PASS_*`,
    `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
    `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`,
    `BUDGET_MONTHLY_EUR` (queda el default 20€), `CRON_SECRET`,
    `CIFRA_ICAL_TOKEN`.
  - **Mantener**: `AUTH_SECRET`, `DATABASE_URL`, `ANTHROPIC_API_KEY`,
    Supabase keys, `DEBUG_SECRET`.
  - Después: redeploy en Vercel dashboard → confirmar login en
    app.cifracompliance.com con la nueva ADMIN_PASSWORD.

### Claude (yo, en próximas sesiones)

- [ ] **Fase 6 — QA visual completa**: recorrer cada ruta con preview
      tools, generar `docs/qa-YYYY-MM-DD.md` con la lista priorizada
      (errores en consola JS, layouts rotos, 500s, inconsistencias de
      diseño). Diego revisa y elige.
- [ ] **Bug fix sprint**: atacar la lista de QA por prioridad.

---

## 🧊 Pending decisions

- [ ] Decidir si las páginas/funciones que sólo Diego usa "a veces"
      siguen merecer estar (ejemplo: `/closing` dashboard, `/legal-watch`
      manual page, `/audit` log explorer). Si no las consultas en 2-3
      semanas, candidatas a quitar.

---

## ✅ Done this week

**2026-05-05** — Reset estratégico cifra dogfood-first (5 fases)

Diego pivotó de "voy a vender pronto" a "dogfood-first single-user".
Ejecutados en una sesión larga + cleanup posterior:

- **Fase 1**: 10 scheduled tasks deshabilitadas + borradas (morning
  brief, legal-watch scan, CRM payment reminders / engagement /
  lead-scoring / anniversaries / trash-purge, tax-ops deadline-alerts /
  recurrence-expand, model-tier-watch). 2 deps no usadas
  desinstaladas (@notionhq/client, better-sqlite3). Memory file
  obsoleto eliminado.
- **Fase 2**: Sentry + PostHog completamente fuera (4 configs +
  sentry-send.ts custom helper + provider + 1 evento + dependencies
  + CSP cleanup + env vars marcadas para borrar de Vercel).
- **Fase 3**: Auth multi-user → single-user (`ADMIN_PASSWORD` env var
  + cookie HMAC simple). Drop /settings/users + /api/users +
  two-person rule. 12 routes refactored (requireRole → requireSession).
  Migration 080 (drop users table CASCADE).
- **Fase 4**: Borrado masivo de sell-features + chat + inbox:
  marketing, portal, approvers, contacts, email drafter, onboarding
  seed, Vercel cron stuck-followups, iCal feed, chat in-product
  (4 routes + components + libs + tests), inbox (page + endpoint).
  Migration 081 (drop entity_approvers, client_contacts, chat_threads,
  chat_messages CASCADE).
- **Fase 5** (docs): borradas positioning.md + BUSINESS_PLAN.md +
  go-to-market-alt-fund-managers.md. Archivadas gassner-audit y
  tax-ops-migration-2026-04-24 a docs/archive/. Reescritos ROADMAP +
  TODO + PROTOCOLS + CLAUDE para reflejar dogfood-first.
- **Budget cap**: 75€ → 20€ (default).

Tests bajaron de 707 → 614 (-93 por la purga). Build verde, tsc clean,
lint:design ok. Migrations 080 + 081 aplicadas a Supabase via MCP.

---

## 📁 Archive

Las semanas anteriores se archivan automáticamente cada lunes a
`docs/archive/TODO-YYYY-WW.md`. Antes del reset había una sección
"Done this week" con ~40 stints (37-67) que ya no aplica al nuevo
posicionamiento; la información histórica vive en git log + commit
messages, que es donde debe vivir.
