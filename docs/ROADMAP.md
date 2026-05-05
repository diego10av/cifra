# cifra · ROADMAP

> Dogfood-first single-user backlog. Diego es el único usuario; cifra
> existe para hacer su trabajo de VAT compliance + CRM personal +
> Tax-Ops más eficiente. Si vuelve al modo "vender" en 6-12 meses,
> esto se rehace.
>
> Last updated: **2026-05-05** (post Fase 5 reset).

---

## 🟢 Now (esta semana)

Estabilizar lo construido. La app tiene tres módulos shipped (CRM,
Tax-Ops, VAT) con muchos bugs visuales y de UX que Diego encuentra al
usar. La prioridad #1 es identificarlos y arreglarlos.

- [ ] **QA visual pass completo** — Claude recorre cada ruta principal
      con preview tools, captura bugs concretos en `docs/qa-2026-05-XX.md`,
      Diego prioriza, se atacan uno a uno por commit.
- [ ] **Bug fix sprint sobre la lista QA** — iterativo, on-demand. Cada
      fix es 1 commit pequeño con before/after.

## 🟡 Next (este mes)

Mejoras de día-a-día, sólo si dogfooding revela que duelen.

- [ ] **Tax-Ops: acceso 1-click al filing actual** — desde la home,
      el filing del trimestre en curso debe estar a 1 click sin
      buscar entidad. (Confirmar al usar.)
- [ ] **VAT: precedent panel mejor sortado** — mostrar precedents
      relevantes ordenados por fecha o frecuencia, no aleatorio.
- [ ] **CRM: vista "esta semana"** — un dashboard simple (matters
      activos + tasks vencidas + opportunities en progreso). Sin
      meter datos nuevos, solo filtros sobre lo que ya hay.

## 🔵 Later (tal vez algún día)

Cosas que pueden tener sentido si dogfooding las pide; no inversión
deliberada hoy.

- [ ] Expansión del corpus sintético del classifier (60 → 100+ fixtures)
      sólo si encuentras casos reales mal clasificados.
- [ ] Soporte para FX rates históricos en input VAT cross-currency
      (hoy se asume EUR; sólo importa si tienes facturas en USD/CHF).
- [ ] Subscription tax (taxe d'abonnement) module si lo empiezas a
      preparar manualmente y duele.
- [ ] Direct tax (CIT/NWT) prep beyond the matrix — sólo si los Tax-Ops
      tabs actuales no son suficiente.

## ⚫ Out of scope (no se construye)

Confirmado fuera del alcance dogfood-first:

- Multi-user, roles (admin/junior/reviewer) — single-user solo.
- Multi-tenant (firm A vs firm B isolation) — single-user solo.
- Cliente approval portal (signed share links) — fuera, Diego revisa
  él mismo.
- Email drafter post-approval — fuera, los emails los escribe Diego.
- Onboarding wizard / first-run UI — fuera, Diego conoce su data.
- Landing page / marketing — fuera, no se va a vender pronto.
- Chat in-product (Ask cifra) — fuera, se borró por mal construido.
- Inbox / notifications page — fuera, se borró.
- Vercel cron jobs — fuera, todos los automatismos quitados.
- iCal feed / calendar subscription — fuera.
- Sentry / PostHog / cualquier telemetría externa — fuera.
- Scheduled tasks (morning brief, legal-watch scan, payment reminders,
  deadline alerts, etc) — todos quitados.
- ViDA Peppol e-invoicing — parqueado por completo. Si Diego acepta
  facturación Peppol obligatoria en LU, lo retomamos como módulo nuevo,
  no como feature.
- AED XSD strict validation — el banner amarillo ("for inspection
  only") se queda hasta que la AED publique un XSD estable. Fuera del
  alcance.

## 📐 Reglas de juego

- **Cualquier feature nueva pasa el filtro Rule §11 (actionable-first)**:
  si no acciona algo concreto en el día-a-día de Diego, no se construye.
- **Cualquier dependencia nueva** (npm package, env var, scheduled task,
  servicio externo) requiere justificación; el default es no.
- **Tests verde antes de cada commit**, sin excepción.
- **Commits pequeños y atómicos** (1 fix = 1 commit) facilitan revertir
  cuando algo se rompe.
