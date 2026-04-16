# Legal-watch triage — open items

> Items surfaced by the fiscal-audit agents (E-1 / E-2 / E-3 / E-4) that
> require independent verification before they can be relied on in a
> filed VAT return. Each item links to the rule or source it affects.
> The maintainer closes an item by (a) verifying against the authoritative
> source, (b) updating the corresponding entry in
> `src/config/legal-sources.ts`, (c) bumping the entry's
> `last_reviewed`, and (d) moving the item to the changelog in
> `docs/legal-watch.md`.

---

## 🟥 Must verify before next filing

### T-001 — AED XSD namespace and FormVersion

- **Source**: Agent E-2, Part 4.2 / 4.3.
- **Flagged files**: `src/lib/ecdf-xml.ts`, `src/lib/ec-sales-list.ts`.
- **What to check**: the current AED eCDF XSD for TVA001N, TVA002NA,
  TVA002NT, TVA002NM and TVA006N published at `https://ecdf.b2g.etat.lu`
  (or successor). The platform emits `xmlns="http://www.ctie.etat.lu/2011/ecdf"`
  which is the first-generation namespace and is likely stale. FormVersion
  is hard-coded `1.0` — should be a year-specific version number.
- **Impact if wrong**: every XML file uploaded to the AED portal is
  rejected as schema-mismatch. No real filings possible.

### T-002 — AED XSD field element name

- **Source**: Agent E-2, Part 4.4.
- **Flagged file**: `src/lib/ecdf-xml.ts`.
- **What to check**: whether the canonical element is `<NumericField>`
  (platform invention) vs. the actual AED schema element (likely
  `<Numeric>` or `<Value>` with an `id` attribute only, no `section`
  attribute).
- **Impact**: same as T-001 — rejection.

### T-003 — AED XSD period encoding

- **Source**: Agent E-2, Part 4.7.
- **Flagged file**: `src/lib/ecdf-xml.ts`, `src/lib/ec-sales-list.ts`.
- **What to check**: whether the AED expects integer period codes
  (0=annual, 1–12=monthly, 13–16=quarterly) vs. the platform's string
  format `"2025-Q1"` / `"2025-MM"` / `"2025"`.
- **Impact**: same as T-001.

### T-004 — AED XSD Agent sub-block

- **Source**: Agent E-2, Part 4.6.
- **Flagged file**: `src/lib/ecdf-xml.ts`.
- **What to check**: when `SenderType=tax_professional`, the AED XSD
  requires an `<Agent>` sub-block identifying the tax professional
  (matricule, firm name, mandate reference). Currently missing.
- **Impact**: same as T-001.

---

## 🟧 Verify within this quarter

### T-010 — AED circular numbers

- **Source**: Agent E-4, uncertainty flag #1.
- **Flagged entries**: `CIRC_723`, `CIRC_764`, `CIRC_798_VAT_GROUP`,
  `CIRC_810`, `CIRC_706_INVOICING`, `CIRC_759_IMPORT` in
  `src/config/legal-sources.ts`.
- **What to check**: the exact current number of each circular against
  the AED's own site / Mémorial publications. The numbers above are
  from practitioner memory and may have been superseded.

### T-011 — LU Tribunal administratif / Cour administrative citations

- **Source**: Agent E-4, Part 4; uncertainty flag #2.
- **Flagged entries**: `CASES_LU.TA_SOPARFI_ACTIVE_HOLDING`,
  `CASES_LU.CA_ART_45_OPTION_FORMALITIES`.
- **What to check**: exact rôle numbers and dates in the Pasicrisie
  administrative or JusCaf database. The current entries carry
  placeholder rôle references.

### T-012 — Art. 56bis LTVA introduction

- **Source**: Agent E-4, uncertainty flag #9.
- **Flagged entry**: Part 1 table of LTVA articles references Art.
  56bis as "place of supply — real-estate services".
- **What to check**: confirm Art. 56bis is the real-estate place-of-
  supply provision and not a different subject (e.g., the margin
  scheme or reverse-charge mechanism). Legilux has the authoritative
  consolidated text.

### T-013 — ViDA final dates in OJ

- **Source**: Agent E-4, uncertainty flag #3.
- **Flagged entry**: `EU_LAW.VIDA_PACKAGE`.
- **What to check**: confirm Directive (EU) 2025/516 (or successor
  number) effective dates — the 2027 / 2028 / 2030 timeline — against
  the Official Journal publication. Negotiation shifted the dates more
  than once.

### T-014 — LU small-business threshold effective date

- **Source**: Agent E-4, uncertainty flag #4.
- **Flagged entry**: `EU_LAW.DIR_2020_285` (effective_from currently
  `2025-01-01`).
- **What to check**: confirm the Loi du 26 juillet 2023 effective date
  at which the LU small-business threshold was raised to €50 000.
  Likely 2025-01-01 but may be earlier.

---

## 🟨 Background verification (low impact; scheduled)

### T-020 — LU standard VAT rate history

- **Source**: Agent E-4, uncertainty flag #5.
- **Flagged entry**: `PRACTICE.PRAC_LU_STANDARD_RATE`.
- **What to check**: confirm no intervening rate change since the
  2024-01-01 restoration to 17%. Re-verify ahead of each budget law.

### T-021 — FAIA current version

- **Source**: Agent E-4, uncertainty flag #6.
- **What to check**: confirm the FAIA schema version the AED currently
  requires for audit-file exports. Relevant for Option B when a
  SAF-T-compatible export is built.

### T-022 — 2024-2026 CJEU AG opinions on Art. 135(1)(g)

- **Source**: Agent E-4, uncertainty flag #7.
- **What to check**: enumerate pending references and AG opinions from
  curia.europa.eu filtering on Art. 135 PVD and Art. 9 PVD. Update
  `CASES_EU` with any new final decisions.

### T-023 — LU B2B e-invoicing mandate timeline

- **Source**: Agent E-4, uncertainty flag #8.
- **What to check**: whether any LU law has brought the B2B e-invoicing
  mandate forward of ViDA 2030. Update `CIRCULARS` if a new circular
  issues.

### T-024 — Versãofast T-657/24 appeal status

- **Source**: Agent E-4, uncertainty flag #10.
- **Flagged entry**: `CASES_EU.VERSAOFAST`.
- **What to check**: check the CJEU register monthly for an appeal
  filed against the General Court decision of 26 November 2025. Appeal
  window was 2 months from notification.

---

## Procedure to close an item

1. Verify the source against the authoritative reference.
2. Update the corresponding entry in `src/config/legal-sources.ts`
   (bump `last_reviewed`, update `citation`/`subject`/`effective_from`
   as needed, add `notes` summarising what was verified).
3. Run `npm test && npm run build` to confirm no regressions.
4. Move the triage item from here to the changelog in
   `docs/legal-watch.md` with date, reviewer and action taken.
5. Commit with message `legal-watch: close T-xxx — <title>`.

---

## How to open a new item

When a reviewer or a spawned agent surfaces a doubt about a legal source
or rule:

1. Add a new entry below with id `T-0nn` (next sequential number).
2. Tag it 🟥 / 🟧 / 🟨 by blast-radius (🟥 = filings rejected or wrong;
   🟧 = specific rule may be wrong; 🟨 = background / scheduled).
3. Link to the source file + line the doubt concerns.
4. Describe the check to perform and the impact if wrong.
