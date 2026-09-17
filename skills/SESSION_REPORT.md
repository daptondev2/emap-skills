# Session Report — EMAP Merchant Signup Form Build

**Task:** `/emap-merchant-signup create a signup form`
**Skill used:** `emap-merchant-signup`
**Integration chosen:** Integration 1 — Full 6-step form, hosted entirely on the partner's site
**Stack:** Plain PHP backend + static HTML/JS frontend (chosen because the project lives under `XAMPP/xamppfiles/htdocs`, and a matching `php-vanilla.php` template exists in the skill)
**Final result:** Build **verified** — 0 confirmed findings remaining after 3 verify rounds

---

## 1. Timeline of phases

| # | Phase | What happened |
|---|-------|----------------|
| 1 | Clarifying questions (mandatory, per skill) | Asked integration variant, then partner-key status, then asked the user to paste the key |
| 2 | Project detection | Inspected the empty project directory; detected XAMPP/PHP context; found `php-vanilla.php` template |
| 3 | Verify-gate hook install (Step 0.5) | Copied hook script, registered Stop hook in `.claude/settings.json`, wrote `emap-build-state.json` = `in_progress` |
| 4 | Reference reading | Read `mode-1-fullform.md`, `php-vanilla.php`, `plain-html.html` (2339 lines, 2 reads), template `README.md` |
| 5 | Build | Copied templates into `merchant-signup/`, wired PHP CSRF + `_step` routing into the HTML, added dropdown-fallback logic to `index.php` (missing from the raw template), created `.env`/`.env.example`/`.gitignore` |
| 6 | **Round 1 verify** | 4 parallel category agents audited the generated code against the schema |
| 7 | **Round 1 confirm** | 13 parallel confirm agents (fast model) independently re-derived each finding from the schema — all 13 CONFIRMED |
| 8 | **Round 1 fix** | 2 parallel fix agents applied all 13 confirmed fixes (one per distinct file) |
| 9 | **Round 2 verify** | Scoped re-audit of only the 2 touched categories (`country_validation`, `conditional_logic`) |
| 10 | **Round 2 confirm** | 1 confirm agent — CONFIRMED |
| 11 | **Round 2 fix** | Applied directly by the build agent (single small, well-understood 3-line fix) |
| 12 | **Round 3 verify** | Final targeted re-check of the round-2 fix |
| 13 | Security & coverage checklist | Manual checklist pass against `security-checklist.md` |
| 14 | Handoff | `emap-build-state.json` → `verified`, summary given to user |

---

## 2. Full agent roster (23 subagents spawned)

All subagents ran as background `general-purpose` agents except confirm agents, which used the `haiku` model per the skill's "Confirm agent model" rule (fast/cheap for narrow fact-checks).

### Round 1 — Verify (4 agents, parallel)

| Agent ID | Category | Result | Tool calls | Duration | Tokens |
|---|---|---|---|---|---|
| `a463f1f2...` | `widget_type` + `hardcoded_label` | **`[]`** — clean | 9 | 61.0 s | 89,013 |
| `a1892616...` | `country_validation` | **4 findings** | 13 | 94.2 s | 89,413 |
| `abd0a310...` | `conditional_logic` (+ no-back-nav) | **9 findings** | 10 | 192.6 s | 122,429 |
| `a4c9eb1f...` | `dropdown_route` | **`[]`** — clean | 6 | 52.9 s | 119,123 |

Wall-clock for this phase ≈ **193 s** (bounded by the `conditional_logic` agent, the largest category with 22 fields).

### Round 1 — Confirm (13 agents, parallel, `haiku`)

Every finding from Round 1 verify was independently re-derived from the primary schema source by a fresh agent that did not trust the verify agent's description.

| Agent ID | Finding checked | Verdict | Tool calls | Duration | Tokens |
|---|---|---|---|---|---|
| `a048335d...` | `business_register_number` CA length | **CONFIRMED** | 13 | 51.6 s | 45,087 |
| `a144005f...` | `account_number` HTML attrs | **CONFIRMED** | 4 | 32.9 s | 32,915 |
| `a826a7b9...` | `routing_number` no server-side check | **CONFIRMED** | 3 | 31.7 s | 32,132 |
| `a329b861...` | `institution_number` pattern never enforced | **CONFIRMED** | 13 | 50.1 s | 38,891 |
| `a320596b...` | `federal_tax_id` wrong trigger field | **CONFIRMED** | 11 | 62.8 s | 54,579 |
| `af1c8a90...` | `business_register_number` conditional bug | **CONFIRMED** | 11 | 56.1 s | 60,443 |
| `a71d9ad0...` | `subscription_frequency` not required | **CONFIRMED** | 6 | 52.9 s | 70,394 |
| `ae497e8a...` | physical address block not required | **CONFIRMED** | 3 | 34.2 s | 67,651 |
| `a77fecdf...` | Owner 2 section not required | **CONFIRMED** | 3 | 51.4 s | 69,839 |
| `abd2f95a...` | driver license fields not required | **CONFIRMED** | 7 | 50.1 s | 82,617 |
| `ad2161ed...` | CA banking fields not required | **CONFIRMED** | 3 | 42.5 s | 68,402 |
| `a7d9779f...` | bankruptcy_discharged not required | **CONFIRMED** | 6 | 53.9 s | 71,237 |
| `a779badb...` | primary-contact owner fields not required | **CONFIRMED** | 3 | 40.8 s | 68,309 |

**13 / 13 CONFIRMED — 0 rejected.** Wall-clock ≈ **63 s** (bounded by the `federal_tax_id` check). Cumulative subagent compute: 610.9 s / 762,496 tokens.

### Round 1 — Fix (2 agents, parallel, one per distinct file)

| Agent ID | File | Findings applied | Tool calls | Duration | Tokens |
|---|---|---|---|---|---|
| `a3ee9e7c...` | `merchant-signup/plain-html.html` | 12 | 26 | 223.2 s | 114,728 |
| `aef22f06...` | `merchant-signup/index.php` | 1 | 6 | 22.6 s | 38,788 |

Wall-clock ≈ **223 s**.

### Round 2 — Verify (2 agents, parallel, scoped re-audit)

Only the two categories touched by Round 1 fixes were re-run (per the skill's "scoped re-audit" rule — categories A and D were untouched and skipped).

| Agent ID | Category | Result | Tool calls | Duration | Tokens |
|---|---|---|---|---|---|
| `a32e2a68...` | `country_validation` | **`[]`** — all 4 fixes verified correct | 9 | 55.9 s | 50,196 |
| `a83680d9...` | `conditional_logic` | **1 new finding** (`customer_pay_currency` — 8/9 fixes verified correct) | 9 | 118.3 s | 109,624 |

### Round 2 — Confirm (1 agent, `haiku`)

| Agent ID | Finding | Verdict | Tool calls | Duration | Tokens |
|---|---|---|---|---|---|
| `a80939f9...` | `customer_pay_currency` missing `.required` toggle | **CONFIRMED** | 3 | 34.0 s | 69,695 |

### Round 2 — Fix

Applied directly by the build agent (not delegated — a single well-scoped 3-line fix across 3 known locations in one file). No subagent spawned for this step.

### Round 3 — Verify (1 agent, final targeted check)

| Agent ID | Scope | Result | Tool calls | Duration | Tokens |
|---|---|---|---|---|---|
| `a6a0efbc...` | `customer_pay_currency` fix only | **`[]`** — clean | 5 | 10.7 s | 36,857 |

---

## 3. Aggregate stats

- **Total subagents spawned:** 23 (4 verify + 13 confirm + 2 fix + 2 verify + 1 confirm + 1 verify)
- **Total verify/confirm/fix rounds:** 3 (capped at 5 per skill rules — finished well under the cap)
- **Total confirmed findings across the whole loop:** 14 (13 in round 1, 1 in round 2) — **all fixed, 0 remaining**
- **Total rejected findings:** 0 (every finding any verify agent raised turned out to be real)
- **Cumulative subagent compute time:** ≈ 1,300 s (~22 min) summed across all 23 agents
- **Cumulative subagent token usage:** ≈ 1,602,000 tokens
- **Approx. wall-clock for the verify→confirm→fix machinery** (summing each phase's slowest agent, since phases ran in parallel internally): ≈ 193 + 63 + 223 + 118 + 34 + 11 ≈ **642 s (~11 min)**

---

## 4. Round 1 findings — full detail

### Category A — `widget_type` + `hardcoded_label`
**Result: `[]` — no issues.** All widgets (checkbox-group for `marketingModel`, radio buttons for `is_physical_address_same_as_legal_address`/`primary_contact`/`bankruptcy_filed.1`/`.2`/`bankruptcy_discharged.1`/`.2`/`current_processing`/`bad_experience`/`multiple_merchant_accounts`, checkbox for `terms_and_conditions_agreed`) and all `staticDropdowns` label rendering matched the schema.

### Category D — `dropdown_route`
**Result: `[]` — no issues.** All 6 dropdown-proxy routes existed with correct EMAP URLs, correct fallback-to-`dropdown-fallbacks.json` logic covering curl errors, timeouts, HTTP ≥400, and empty/malformed `data`, and the frontend correctly called all 6 routes and populated the right elements.

### Category B — `country_validation` (4 findings, all confirmed)

1. **`business_register_number` — CA length not enforced (blocker)**
   Schema: `countryVariants.CA.maxLength = 11` (default 20).
   Actual: HTML input hardcoded `maxlength="20"` always; no JS or PHP length enforcement for CA's 11-char cap.

2. **`account_number` — US length not enforced via HTML attrs (minor)**
   Schema: `countryVariants.US: minLength 8, maxLength 17`.
   Actual: HTML stayed at static `maxlength="20"` for all countries, no `minlength`; the submit-time JS check (8–17 chars) *was* correct and blocking, so this was a missing defense-in-depth layer, not a functional gap. No server-side (PHP) check existed either.

3. **`routing_number` — no server-side check (minor)**
   Schema: `countryVariants.US: exactLength 9, pattern ^[0-9]{9}$`.
   Actual: HTML attribute + submit-time JS enforcement were both correct. But `index.php`'s step-5 handler forwarded the raw field straight to EMAP with zero server-side validation — unlike steps 2 (EIN) and 4 (SSN), which do have PHP-side format checks.

4. **`institution_number` — pattern never actually enforced (blocker)**
   Schema: `maxLength 3, pattern ^[0-9]{3}$`, required/shown only for CA.
   Actual: HTML had `maxlength="3" pattern="[0-9]{3}"`, but the form had `novalidate` and the submit handler called `e.preventDefault()` immediately without ever calling `checkValidity()`/`reportValidity()`, so native HTML5 pattern validation never ran. The step-5 submit handler only re-validated `routing_number`/`account_number` in JS — `institution_number` was never referenced there. No server-side check either. Net effect: the CA 3-digit pattern was only a visual hint, never enforced.

### Category C — `conditional_logic` (9 findings, all confirmed)

1. **`federal_tax_id` — wrong trigger field (blocker)**
   Schema trigger: the Step-1 formation country (`country_from_step1` / `step1Country`).
   Actual: `updateFederalTaxVisibility()` computed `var country = document.getElementById('address_country').value || step1Country;` — driven primarily by the Step-2 *legal address* country field, only falling back to `step1Country` when empty. If a merchant's Step-1 formation country differed from their Step-2 legal address country, the field showed/hid based on the wrong country.

2. **`business_register_number` — same wrong-trigger bug + never required (blocker)**
   Same root cause as #1 (uses `address_country` instead of `step1Country`). Additionally, no `.required` was ever set on the field anywhere in the file, and neither the Step 2 submit handler nor `index.php` checked its presence — it could be submitted blank even when required.

3. **`subscription_frequency` — not required when visible (minor)**
   Schema: `marketingModel` includes `2` → show **and require**.
   Actual: visibility toggled correctly, but `.required` was never set on `subscription_frequency` itself (only its child `subscription_frequency_other` got toggled), and the Step 2 submit handler had no presence check.

4. **Physical address block (6 fields) — not required when visible (blocker)**
   Fields: `physical_address_street_number/_street_address/_city/_state/_postal_code/_country`.
   Actual: the `#physical_address_section` block showed/hid correctly, but none of the 6 fields ever got `.required` set, had no static `required` HTML attribute, and the Step 2 submit handler performed no presence check. The block could be submitted completely blank even when "different physical address" was selected.

5. **Owner 2 section (13 fields) — not required when visible (blocker)**
   Fields: `first_name.2, last_name.2, email.2, phone.2, title.2, ownership_percentage.2, street_number.2, street_address.2, city.2, state.2, postal_code.2, country.2, license.2`.
   Actual: `#owner2_section` visibility toggled correctly on the ownership-percentage input, but none of these fields got `.required` set or a static `required` attribute, and the Step 4 submit handler had no presence check for any of them except `ssn.2` (correctly checked). `dob.2` was validated *only if a value happened to be present* (`if (hasOwner2 && payload['dob.2'])`), so an empty `dob.2` silently passed. A user could leave nearly all Owner 2 fields blank and still submit successfully.

6. **`driver_license_state.1/.2` + `driver_license_expiration_date.1/.2` — not required when visible (minor)**
   Actual: visibility correctly toggled for both owners based on `country.N === 'US'`, and payload inclusion was correctly gated — but none of the 4 fields ever got `.required` set, and no submit-time presence check existed.

7. **`bankruptcy_discharged.1/.2` + `bankruptcy_discharged_date.1/.2` — not required when visible (minor)**
   Actual: the visibility cascade (`bankruptcy_filed=1` → show discharged; `discharged=1` → show discharged date) worked correctly for both owners, and payload inclusion matched — but no `.required` toggle and no submit-time presence validation existed, so these could be left blank while visible.

8. **`institution_number` / `customer_pay_currency` — not required when CA banking shown (minor)**
   Actual: visibility was correctly driven by the *Step-1* country (the one field in this whole batch that used the right trigger from the start) — but neither field ever got a `.required` toggle, and the Step 5 submit handler had no presence check for either when shown.

9. **`first_name.1` / `last_name.1` / `email.1` — not required when `primary_contact=0` (minor)**
   Actual: the `#owner1_name_group` visibility toggled correctly, and the Step 4 payload correctly included these fields only when needed — but only `primary_contact_job_title` got a `.required` toggle; the other 3 fields never did, and no submit-time presence check existed for them.

**Back-navigation check (part of category C):** no violations found in round 1 or any later round — no Back button and no `goToStep(n)` call to a lower step exists anywhere in steps 2–6.

---

## 5. Round 2 finding (post-fix regression check)

Round 2 re-audited only `country_validation` and `conditional_logic` (the two categories touched by round-1 fixes).

- **`country_validation` round 2: `[]`** — all 4 round-1 fixes verified correct with no regressions.
- **`conditional_logic` round 2: 1 new finding** —

  **`customer_pay_currency` — still not required (blocker)**
  The round-1 fix agent added `.required` toggling for `institution_number` correctly in all 3 places CA-banking visibility is set (the Step-1 country change listener, `restoreSession()`, and the post-Step-1-success handler) — but missed doing the same for `customer_pay_currency`, which is a **radio group** (`name="customer_pay_currency"` across `#cur_usd`/`#cur_cad`), not a single element, so the same one-line pattern didn't directly apply and was skipped. 8 of the other 9 round-1 `conditional_logic` fixes verified fully correct.

This finding was confirmed by 1 fast-model confirm agent, then fixed directly (not delegated — a small, well-understood 3-line change adding `document.querySelectorAll('[name="customer_pay_currency"]').forEach(r => r.required = ...)` at the same 3 locations `institution_number` already used). Round 3 re-verified this fix in isolation and returned `[]`.

---

## 6. Files created / modified

| File | Purpose |
|---|---|
| `merchant-signup/index.php` | PHP backend: proxies all 6 EMAP steps + 6 dropdown routes, CSRF protection, honeypot, `.env` loader, dropdown-fallback logic, server-side EIN/SSN/routing-number validation |
| `merchant-signup/plain-html.html` | The complete 6-step form UI, wired to `index.php` |
| `merchant-signup/dropdown-fallbacks.json` | Static snapshot used when live EMAP dropdown calls fail |
| `merchant-signup/.env` | `EMAP_BASE_URL` + `EMAP_PARTNER_KEY` (your key), gitignored |
| `merchant-signup/.env.example` | Template for the above, safe to commit |
| `merchant-signup/.gitignore` | Ignores `.env` |
| `.claude/hooks/emap-verify-gate.py` | Stop-hook script enforcing the verify loop before the session can end |
| `.claude/settings.json` | Registers the Stop hook |
| `.claude/emap-build-state.json` | Final state: `{"status": "verified", "integration": "1", "rounds": 3, "confirmed_findings": []}` |

---

## 7. Security & coverage checklist (Integration 1 subset)

- ✅ Partner key only in `.env` — grepped the entire `merchant-signup/` tree, key appears nowhere else
- ✅ `.env` is gitignored
- ✅ Backend validation present before forwarding to EMAP (EIN, SSN, routing-number formats)
- ✅ Submit button disables on first click (`btn.disabled = true` in `submitStep()`)
- ✅ Generic user-facing error messages (EMAP's raw errors are not surfaced)
- ✅ `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` set on the form response
- ⏭ HTTPS/HSTS/CSP — deferred; these are deployment-time concerns once this moves off local XAMPP to a real host
- N/A `Referrer-Policy: no-referrer` — only required for Integration 2 (redirect handoff), not applicable here
