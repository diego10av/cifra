# Classification research — deep technical reference

> Internal research document feeding cifra's classifier rules. Every
> rule in `src/config/classification-rules.ts` that touches one of
> these topics MUST cite the source ids here (propagated into
> `src/config/legal-sources.ts`).
>
> **Scope**: six topics Diego flagged 2026-04-19 as the highest-impact
> classification gaps to close before the 2nd customer meeting.
>
> **Principle**: for each topic, we map the VAT analysis against the
> three dimensions a LU fiduciary faces daily — (i) who is the supplier,
> (ii) what is the supply, (iii) where does it happen — and translate
> to a cifra classifier decision with a flag when the case is contested.
>
> Last reviewed: 2026-04-19.

---

## 1. Independent directors — natural + legal persons

### Statutory + case-law scaffold

| Source | Year | Summary |
|---|---|---|
| **LTVA Art. 4§1** | — | A "taxable person" is anyone carrying out an economic activity **independently**, whatever the purpose or result. |
| **Directive 2006/112 Art. 9§1** | — | Mirror of LTVA Art. 4§1 (source text). |
| **Directive 2006/112 Art. 10** | — | Persons bound to an employer by a contract of employment or by any other legal ties creating a relationship of subordination are EXCLUDED from the definition of taxable person. |
| **CJEU C-202/90 Ayuntamiento de Sevilla** | 1991 | Baseline test for independence: can the person organise their own means and bear their own economic risk? |
| **CJEU C-420/18 IO** | 2019-06-13 | A member of a Dutch foundation's supervisory board is NOT a taxable person — no personal economic risk, collegial decision-making. |
| **CJEU C-288/22 TP** | **2023-12-21** | A natural person acting as independent director of a Luxembourg SA is NOT a taxable person: (a) he does not act on his own account, (b) he does not bear the economic risk of his activity — his fees are fixed and paid regardless of the company's performance, (c) decisions are taken collegially by the board. |
| **AED Circ. 781-1** | 2016-09-30 | Pre-C-288/22 position: all independent directors (natural or legal persons) are taxable persons; their fees are subject to 17% VAT. |
| **AED Press Release** | 2023-12-22 | Post-C-288/22 acknowledgement: natural-person directors stop charging VAT effective immediately; refunds available for prior VAT charged within statute of limitations (Art. 71 LTVA). |
| **AED Circ. 781-2** | 2024 (exact date TBC in legal-watch-triage) | Replaces 781-1 for natural-person directors (NOT taxable); maintains taxable position for **legal-person directors**. |

### The natural-person director path (settled)

A natural person sitting on the board of a Luxembourg SA / SARL / SCA
/ SCSp's general partner / AIFM / fund entity → **NOT a taxable
person**. The director does NOT issue a VAT invoice, does NOT charge
17%, does NOT appear on the recipient company's VAT return as
reverse-charged.

**cifra classifier behaviour** (new RULE 32a):
- Direction: `incoming`
- Country: any (including non-EU — the test applies at the supplier's
  level, not the territorial one)
- Keywords: `director fee`, `jetons de présence`, `tantièmes`,
  `vergütung für verwaltungsratsmitglied`, `board member fee`,
  `administrator fee`, `tantièmes d'administrateur`,
  `indemnité de conseil d'administration`
- If the supplier is explicitly flagged as a natural person (via a
  future `supplier_is_natural_person` field, default inferred from
  supplier name pattern: no legal suffix)
- → Treatment: **OUT_SCOPE**
- → Reason: "Fees paid to a natural-person independent director — not a taxable person (CJEU C-288/22 TP; AED Circ. 781-2 post-2024)."
- → Flag: false (settled law)

### The legal-person director path (contested, flag = true)

A legal person — typically a CSP firm, a Big 4 entity, a holding
company — acting as a director of a LU company. AED maintained
post-C-288/22 that legal-person directors ARE taxable persons on the
theory that:
- A legal person is its own independent entity (no subordination)
- A legal person can be sued independently (economic risk present)
- A legal person has its own management and resources

**But this position is actively contested by LU tax practitioners**,
who argue C-288/22's logic (no independent economic risk on the
director's own activity) extends identically to a legal person
acting in a collegial body. As of 2026-Q2 there is:
- No superseding CJEU ruling
- No LU Tribunal administratif / Cour administrative decision on the
  legal-person point specifically
- Practical risk: if the AED's position is challenged and overturned,
  firms who invoiced VAT will need to refund; firms who didn't may
  face penalties

**cifra classifier behaviour** (new RULE 32b):
- Direction: `incoming`
- Country: any
- Keywords: same as 32a, PLUS supplier name contains a legal-entity
  suffix (SA, SARL, SCS, SCSp, Ltd, LLC, GmbH, BV, NV, etc.)
- → Treatment: **LUX_17** (or RC_EU_TAX / RC_NONEU_TAX depending on
  supplier country)
- → Reason: "Legal-person director fee — taxable per AED post-2024 practice (Circ. 781-2). The position is contested post-C-288/22 TP; monitor LU jurisprudence."
- → Flag: **true**
- → Flag reason: "This treatment follows AED Circ. 781-2 post-2024 practice (legal-person directors remain taxable). LU practitioners contest this as inconsistent with CJEU C-288/22 TP (which held natural-person directors are not taxable). Confirm client's preferred treatment — some firms are taking the contested position and NOT charging/deducting VAT on legal-person director fees pending further CJEU guidance. Document the decision in the audit log."

### Cross-border directors

If the director is a natural person resident in another country (e.g.,
a UK individual on a LU SA board), the test still applies at the
**supplier level**. Per C-288/22's reasoning, the natural person is not
a taxable person regardless of residence. Therefore:
- No VAT on the fee, no reverse-charge
- If the director invoices with foreign VAT (e.g., a French fiscal
  authority assumed the fee was taxable), that's a supplier error —
  not cifra's job to correct beyond flagging.

### Out-of-scope vs exempt — why OUT_SCOPE not EXEMPT_44

A director fee could conceivably be mapped to EXEMPT_44 under some
flavour of Art. 44. But the correct analysis is:
- "Exempt" presumes the supply IS a taxable transaction falling within
  VAT's scope, then carved out by a specific exemption (Art. 44).
- C-288/22's ruling is that the director's activity is NOT an economic
  activity at all → no transaction within VAT's scope → OUT_SCOPE.
- OUT_SCOPE ≠ EXEMPT. The former means the supply never entered the
  VAT system; the latter means it entered but is exempted.

This distinction matters for:
- Box placement in eCDF (OUT_SCOPE does NOT appear on the return; EXEMPT does, in Annexe B)
- Pro-rata denominator (EXEMPT supplies inflate the exempt turnover, reducing the deduction ratio; OUT_SCOPE does not)
- Audit-trail defensibility (the reason string carries the legal basis)

---

## 2. Pro-rata computation — mixed-use fund managers

### Statutory + case-law scaffold

| Source | Summary |
|---|---|
| **LTVA Art. 50§1** | Default general pro-rata: `deduction_ratio = turnover_with_deduction / (turnover_with_deduction + turnover_without_deduction)`. Rounded up to the next whole percentage. |
| **LTVA Art. 50§2** | Direct attribution alternative: when records allow, input VAT may be attributed directly to the supply it relates to (full deduction for taxable-related; zero for exempt-related). |
| **LTVA Art. 50§3** | Specific sector ratios: for firms with distinct activity sectors, a separate ratio per sector may be used with AED authorisation. |
| **LTVA Art. 49§2** | **Exception**: input VAT on supplies exempt under Art. 44§1 a (banking, securities) or 44§1 d (fund management) IS deductible if the recipient is established outside the EU. Transposes Directive Art. 169(c). |
| **LTVA Art. 56ter** | Regularisation on capital goods over 5 years (movable) or 20 years (real estate) when the deduction ratio changes materially. |
| **Directive 2006/112 Art. 173-175** | Base rules for the general pro-rata (Art. 173), alternatives (Art. 174), and the list of supplies excluded from the fraction (Art. 175). |
| **Directive 2006/112 Art. 169(c)** | Source text for LTVA Art. 49§2's non-EU exception. |
| **CJEU C-511/10 BLC Baumarkt** | 2012 | Member States can require a sector-based deduction method when it gives more accurate results than the general ratio. |
| **CJEU C-165/17 Morgan Stanley** | 2019 | Cross-border deduction: a branch providing services to its head office in another country deducts based on a combined fraction. Relevant to LU branches of non-EU firms. |

### The fund-manager case Diego flagged

A Luxembourg holding (SOPARFI or similar) does two activities:

- **Activity A**: provides management services to a LU fund → exempt under Art. 44§1 d.
- **Activity B**: makes loans to subsidiaries → exempt under Art. 44§1 a (financial services).

Both exempt → no outgoing VAT. But the SOPARFI incurs input VAT (office rent, audit fees, IT). The deduction question has FOUR sub-cases depending on where B's loans go:

| Sub-case | Borrower jurisdiction | Legal basis | Deduction right |
|---|---|---|---|
| B1 | Loans INSIDE LU | Art. 44§1 a exempt, no credit mechanism | **NO deduction** on related input VAT |
| B2 | Loans INSIDE EU (outside LU) | Art. 44§1 a exempt, no credit mechanism | **NO deduction** on related input VAT |
| B3 | Loans OUTSIDE EU (US, UAE, Cayman, etc.) | Art. 49§2 exception → treated as "with deduction" | **FULL deduction** on directly-linked input VAT + proportional on common costs |
| B4 | Mixed portfolio | Apportionment | Partial deduction per sub-portfolio breakdown |

And independently for Activity A:

| Sub-case | Fund location | Legal basis | Deduction right |
|---|---|---|---|
| A1 | LU fund | Art. 44§1 d exempt, no credit mechanism | **NO deduction** on related input VAT |
| A2 | EU fund (non-LU) | Art. 44§1 d exempt, no credit mechanism | **NO deduction** on related input VAT |
| A3 | Non-EU fund | Art. 49§2 exception | **FULL deduction** on directly-linked input VAT + proportional on common costs |

### The practical computation

Input VAT falls into three buckets:

1. **Directly attributable to with-deduction supplies** → 100% deductible
2. **Directly attributable to without-deduction supplies** → 0% deductible
3. **Common / mixed-use costs** → deductible at the general ratio

The general ratio (Art. 50§1) is computed as:

```
ratio = (Σ turnover_with_deduction) / (Σ turnover_with_deduction + Σ turnover_without_deduction)
```

Where:
- **turnover with deduction** includes: taxable supplies (17%/14%/8%/3%), OSS supplies, intra-community supplies, Art. 49§2 exception supplies (financial exemptions to non-EU recipients), any other zero-rated with credit.
- **turnover without deduction** includes: standard Art. 44 exempt supplies (44§1 a/b/c/d/f where recipient is in EU).
- **excluded from both** (Art. 175 Directive / LTVA implementation): sale of capital goods used in the business, occasional real-estate transactions, occasional financial transactions.

### cifra's UI requirement (Diego: "clarísimo")

The `/declarations/[id]` pro-rata section must show — for each period:

1. **Total input VAT** (the sum before apportionment) — big number, monospaced
2. **Methodology**: radio-group [General ratio · Direct attribution · Sector ratios]
3. If general ratio:
   - Numerator: € turnover with deduction — **link to edit** the underlying breakdown
   - Denominator: € turnover (total eligible)
   - Ratio: XX%
4. **Deductible input VAT**: (total × ratio) — **green** card
5. **Non-deductible input VAT**: (total × (1 − ratio)) — **red-amber** card
6. **Legal basis** for the chosen methodology — inline text
7. **"Explain this computation"** button → modal with the full calc
   trail + CJEU/LTVA citations per step

And in the audit-trail PDF: one page with the computation + basis +
citations, always.

### Schema requirement

New table `entity_prorata`:

```sql
CREATE TABLE entity_prorata (
  id                 TEXT PRIMARY KEY,
  entity_id          TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  period_start       DATE NOT NULL,
  period_end         DATE NOT NULL,
  method             TEXT NOT NULL CHECK (method IN ('general', 'direct', 'sector')),
  ratio_num          NUMERIC(14, 2),    -- turnover with deduction (€)
  ratio_denom        NUMERIC(14, 2),    -- total eligible turnover (€)
  ratio_pct          NUMERIC(5, 2),     -- rounded-up percentage 0-100
  basis              TEXT,              -- free-text methodology justification
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entity_prorata_period
  ON entity_prorata(entity_id, period_start, period_end);
```

A declaration picks the `entity_prorata` row where `period_start ≤
declaration.period_end AND period_end ≥ declaration.period_start`. If
none, the UI defaults to 100% deduction with a red "MISSING PRO-RATA
CONFIG" banner.

---

## 3. SPV passive holding — reinforcing Polysar/Cibo

### Statutory + case-law scaffold

| Source | Summary |
|---|---|
| **LTVA Art. 4§1** | Taxable person test: economic activity carried out independently. |
| **CJEU C-60/90 Polysar** | 1991 | A pure holding whose only activity is holding shares and receiving dividends is NOT engaged in economic activity → not a taxable person. |
| **CJEU C-16/00 Cibo Participations** | 2001 | An active holding providing administrative / financial / commercial services to its subsidiaries IS engaged in economic activity for those services → taxable person. |
| **CJEU C-320/17 Marle Participations** | 2018 | Letting immovable property to a subsidiary counts as active management. |
| **CJEU C-108/14 + C-109/14 Larentia + Minerva** | 2015 | A mixed holding can deduct input VAT on acquisition costs proportionally to the active portion. |
| **LTVA Art. 49§1** | No deduction for a non-taxable person. |

### Classification matrix

| Entity type | Incoming cross-border service | Incoming LU service with VAT | Outgoing dividend | Outgoing service |
|---|---|---|---|---|
| `passive_holding` | ⚠ Flag: supplier should have charged origin VAT; no LU RC obligation (RULE 11P/13P already). | ⚠ Flag: LU VAT is charged but NOT deductible (non-taxable person). NEW: classify as LUX_17_NONDED. | OUT_SCOPE (dividend = not a supply) | n/a (should not issue service invoices) |
| `active_holding` | Normal RC per country (RULE 11/13). Deduction per entity's own taxable/exempt split (pro-rata). | Normal — deduction per pro-rata. | OUT_SCOPE | Normal per rate / exemption. |
| `fund` | RC_EU_EX / RC_NONEU_EX when "fund management specific and essential" per BlackRock. Otherwise taxable RC. | Normal. | OUT_SCOPE | Normal. |

### cifra classifier enhancement (new RULE 15P)

When `entity_type === 'passive_holding'` AND LU VAT applied:
- Override the LU rate rules (RULE 1/2/3/4)
- Classify as **LUX_17_NONDED** with reason "LU input VAT received by a passive holding — not deductible per Polysar C-60/90 (no taxable activity means no deduction right per Art. 49§1 LTVA)"
- Flag: true
- Flag reason: "This entity is registered as `passive_holding`. If it in fact has active management services (Cibo / Marle), re-classify the entity as `active_holding` to unlock the pro-rata deduction."

This complements the existing RULE 11P/13P (cross-border incoming) to
close the domestic LU leg of the same story.

### Existing RULE 11P/13P — already correct

No change needed. Already flags cross-border incoming services to a
passive holding with the Polysar + Cibo citations. Verify via the
existing 60-case fixture corpus.

---

## 4. Carry interest — OUT_SCOPE vs 17% (economic substance test)

### Statutory + case-law scaffold

| Source | Summary |
|---|---|
| **LTVA Art. 2** | VAT applies to supplies of goods and services for consideration by a taxable person acting as such. A profit distribution is not a supply. |
| **CJEU C-432/15 Baštová** | 2016 | Prize money for a horse owner running in a race is not consideration for services if the prize is uncertain — no direct link between supply and consideration. |
| **CJEU C-16/93 Tolsma** | 1994 | Consideration requires a legal relationship with reciprocal performance. |
| **CJEU C-11/15 Český rozhlas** | 2016 | Public-broadcasting licence fee: no direct link between service and payment → no supply. |
| **PRACTICE.PRAC_CARRY_INTEREST** | 2026 | LU market consensus: carry paid to a GP-investor is a return on invested capital → OUT_SCOPE. Carry paid to a pure-service GP with no economic participation may re-characterise as a performance fee for services → TAXABLE 17%. |

### Classification logic

**Case A: Carry paid to a GP with skin in the game**
- GP made a 1-5% commitment alongside LPs.
- GP receives carry (typically 20% over hurdle) as a return on that commitment + bonus.
- Economic analysis: the carry IS a profit distribution on invested capital → no supply, no consideration → OUT_SCOPE.
- **cifra**: RULE 33 → OUT_SCOPE, flag: true, reason "Carry interest paid to an investor-GP (economic participation present) — out of scope as a profit distribution, not a supply."

**Case B: Carry paid to a pure-service GP**
- GP has no own economic participation (or only a nominal €1 commitment).
- The "carry" label is a compensation for portfolio-management services.
- Economic substance: performance fee for a taxable service.
- **cifra**: RULE 33-alt → LUX_17 (or exempt under Art. 44§1 d if the recipient is qualifying + AIFMD-delegated), flag: true, reason "Carry-labelled payment to a GP without economic participation — substance is a performance fee; re-classify as a taxable service."

### Reviewer workflow

The classifier cannot determine from an invoice alone whether the GP is an
investor-GP (Case A) or a service-GP (Case B). It ALWAYS flags when a
carry keyword matches, routing the reviewer to confirm economic
substance against the limited-partnership agreement (LPA) / AIFM
agreement.

### Keyword triggers (new `CARRY_INTEREST_KEYWORDS`)

```
'carried interest', 'carry interest', 'carry', 'performance allocation',
'intéressement différé', 'performance fee waterfall',
'gewinnbeteiligung', 'carry distribution', 'carry payment',
'gp carry', 'gp profit share', 'promote' (US-style)
```

---

## 5. Waterfall distributions + structuring fees

### Statutory + case-law scaffold

Same as §4. Add:

| Source | Summary |
|---|---|
| **CJEU C-465/03 Kretztechnik** | 2005 | Share issues are not a supply within VAT's scope — capital-raising is outside VAT. |
| **PRACTICE.PRAC_WATERFALL_DISTRIBUTION** | 2026 | Waterfall distributions to LPs / GP / other parties flow from an investment return — OUT_SCOPE. Any embedded "structuring fee" line has independent taxable character. |

### Classification logic

**Waterfall line item: LP distribution**
- Economic substance: return on LP's capital commitment → profit distribution.
- **cifra**: RULE 34 → OUT_SCOPE, reason "Waterfall distribution to LP — return on investment, not a supply (Kretztechnik C-465/03; LU market practice)."

**Waterfall line item: "Structuring fee" or "set-up fee"**
- Economic substance: a service fee (structuring the deal, legal set-up, tax optimisation).
- **cifra**: RULE 34-alt → LUX_17 (if supplier is LU) or standard foreign-supplier path.

### The GP catch-up

"Catch-up" = the waterfall step where the GP receives 100% of profits
between the hurdle and its carry-bearing threshold, to compensate for
the preferential-return step already paid to LPs. Same analysis as
carry: profit-distribution if GP is investor-GP; taxable service fee if
pure-service GP.

---

## 6. Cost-sharing (Art. 44§1 y / Art. 132(1)(f) Directive)

### Statutory + case-law scaffold

| Source | Summary |
|---|---|
| **LTVA Art. 44§1 y** | Services supplied to members by an independent group of persons (IGP) are exempt if: (i) the members carry out exempt or non-taxable activities, (ii) the services are directly necessary for those activities, (iii) the group merely claims reimbursement of its share of the joint expenses, (iv) the exemption doesn't distort competition. |
| **Directive Art. 132(1)(f)** | Source text (narrower scope in Directive than the LU transposition). |
| **CJEU C-326/15 DNB Banka** | 2017-09-21 | The exemption does NOT apply to financial-sector members. |
| **CJEU C-605/15 Aviva** | 2017-09-21 | Same for insurance-sector members. |
| **CJEU C-77/19 Kaplan International** | 2020-11-18 | **Cross-border cost-sharing does NOT qualify**: members must be in the same Member State. |
| **CJEU C-274/15 Commission v Luxembourg** | 2017 | LU's prior transposition (which allowed deduction for services to members who also had some taxable activity) was incompatible — now fixed. |

### Practical impact on LU fund structures

Many LU fund platforms set up "central-services" entities that invoice
member funds for shared IT, admin, legal, marketing. Pre-Kaplan, some
of these billed cross-border LU → FR / BE / DE as exempt IGP. Post-Kaplan
(2020), that's illegal — cross-border IGP does NOT qualify.

Additionally per DNB Banka + Aviva: financial-sector funds (banks,
AIFMs, insurance-like vehicles) can't use IGP even within LU.

### cifra classifier enhancement (new RULE 35)

Keywords: `cost-sharing`, `cost sharing`, `igp`, `independent group of persons`,
`groupement autonome de personnes`, `gap`, `art. 44§1 y`, `article 44(1)(y)`,
`kostenteilungsgemeinschaft`, `article 132(1)(f)`, `cost-pooling agreement`.

Rule logic:
- If country ≠ LU (cross-border) → **NEVER exempt** → classify as
  RC_EU_TAX / RC_NONEU_TAX at 17%, reason "Cross-border cost-sharing —
  does not qualify for Art. 44§1 y per CJEU Kaplan C-77/19. Taxable."
- If country = LU + recipient is a financial/insurance entity → still NOT
  exempt → LUX_17. Flag: true, reason "LU-to-LU IGP invoice but
  recipient sector (fund/AIFM/insurance) is excluded from the exemption
  per CJEU DNB Banka C-326/15 + Aviva C-605/15."
- If country = LU + recipient is non-financial → LUX_00 (exempt Art.
  44§1 y). Flag: true, reason "IGP exemption applicable — verify the
  four conditions (exempt/non-taxable activities, directly necessary,
  reimbursement at cost, no competition distortion)."

---

## 7. Cross-reference summary — which source ids to add to legal-sources.ts

New entries needed in `src/config/legal-sources.ts`:

### LU_LAW
- `LTVA_ART_4` — taxable-person definition (for directors + passive holding rules)
- `LTVA_ART_49` — deduction principles + Art. 49§2 non-EU exception (for pro-rata)
- `LTVA_ART_50` — pro-rata formula + alternatives
- `LTVA_ART_56TER` — regularisation on capital goods
- `LTVA_ART_44_1_Y` — IGP exemption specifically (today covered by LTVA_ART_44 generically)

### EU_LAW
- `DIR_2006_112_ART_9` — taxable-person definition source
- `DIR_2006_112_ART_10` — employment-subordination exclusion
- `DIR_2006_112_ART_132_1_F` — IGP exemption Directive source
- `DIR_2006_112_ART_169_C` — non-EU financial exemption deduction right
- `DIR_2006_112_ART_173` / `ART_174` / `ART_175` — pro-rata methodology

### CIRCULARS
- `CIRC_781_1` — 2016 directors position (replaced)
- `CIRC_781_2` — 2024 directors position (current — natural not taxable, legal still)

### CASES_EU
- `IO` (C-420/18 IO) — 2019 supervisory director
- `TP` (C-288/22 TP) — 2023 LU director
- `POLYSAR` (C-60/90) — 1991 passive holding (not yet in sources; classifier cites via reason text)
- `CIBO` (C-16/00) — 2001 active holding (same)
- `BASTOVA` (C-432/15) — 2016 prize money / direct link
- `TOLSMA` (C-16/93) — 1994 consideration test
- `CESKY_ROZHLAS` (C-11/15) — 2016 licence-fee
- `KRETZTECHNIK` (C-465/03) — 2005 share issues
- `BLC_BAUMARKT` (C-511/10) — 2012 sector-based pro-rata
- `DNB_BANKA` (C-326/15) — 2017 IGP financial exclusion
- `AVIVA` (C-605/15) — 2017 IGP insurance exclusion
- `COMMISSION_V_LUXEMBOURG_IGP` (C-274/15) — 2017 LU IGP infringement

### PRACTICE
- Expand `PRAC_CARRY_INTEREST` with the Case A / Case B split detail
- New `PRAC_WATERFALL_CATCHUP` — GP catch-up analysis
- New `PRAC_DIRECTORS_LEGAL_PERSON` — contested AED post-2024 position

---

## 8. Classifier rule summary (to implement)

| Rule | Trigger | Treatment | Flag? | Legal refs |
|---|---|---|---|---|
| **32a** | Natural-person director fee | OUT_SCOPE | no | C-288/22 TP, Circ. 781-2 |
| **32b** | Legal-person director fee | LUX_17 / RC_EU_TAX / RC_NONEU_TAX | **yes** | Circ. 781-2, contested |
| **33** | Carry-interest keywords, GP with own commitment | OUT_SCOPE | yes (confirm substance) | PRAC_CARRY, Baštová, Tolsma |
| **33-alt** | Carry keyword, service-GP (flagged by reviewer) | LUX_17 or EXEMPT_44 | yes | same |
| **34** | Waterfall-distribution keyword | OUT_SCOPE | yes | Kretztechnik, PRAC_WATERFALL |
| **34-alt** | Structuring-fee / set-up-fee line within waterfall | LUX_17 | yes | standard taxable |
| **35** | IGP keyword + cross-border | RC_EU_TAX / RC_NONEU_TAX | yes | Kaplan C-77/19 |
| **35-lu** | IGP keyword + LU + financial recipient | LUX_17 | yes | DNB Banka, Aviva |
| **35-ok** | IGP keyword + LU + non-financial recipient | LUX_00 | yes (verify 4 conditions) | Art. 44§1 y |
| **15P** | `entity_type='passive_holding'` + LU VAT applied | LUX_17_NONDED | yes | Polysar C-60/90, Art. 49§1 LTVA |

Existing RULE 11P/13P (passive-holding cross-border) already covers
the cross-border leg.

---

*This document is the source of truth for the classifier changes in
stint 11. When AED issues a superseding circular or a new CJEU ruling
lands on any of these topics, update the relevant section + propagate
to `legal-sources.ts` + flag the affected rule in
`docs/legal-watch-triage.md`.*
