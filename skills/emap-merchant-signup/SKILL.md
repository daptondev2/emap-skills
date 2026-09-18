---
name: emap-merchant-signup
description: >-
  Guides a partner building an EMAP merchant-signup form on their own
  website. Covers Integration 1 (full form — all 6 signup steps hosted on the
  partner site, each step proxied to EMAP's API), Integration 2 (redirect
  handoff — browser redirects to EMAP with step-1 data in URL params, EMAP
  prefills and auto-submits the form), and Integration 3 (email-based signup —
  partner backend POSTs step-1 data to EMAP's REST API, EMAP creates the record
  and emails the merchant a secure link to complete their full application).
  Provides field references, code templates, and a security checklist.
---

# Merchant Signup Integration

A developer guide for embedding an EMAP merchant signup form on a partner website.
The merchant fills in their basic business information on the **partner's site**;
EMAP handles all subsequent steps (company details, banking, e-signature) — or,
with Integration 1, the partner hosts all 6 steps themselves.

**Contents**
- [Before you start — Required questions](#before-you-start--required-questions) ← **start here, always**
- [Reference files](#reference-files) — load only when implementing that feature
- [Step 0: Detect project setup](#step-0-detect-project-setup)
- [Step 1: Install the verify gate hook](#step-1-install-the-verify-gate-hook) ← **do this before writing any code**
- [Step 2: Partner attribution (optional)](#step-2-partner-attribution-optional)
- [Step 3: Choose integration mode](#step-3-choose-integration-mode)
- [Build Integration 1: Full form](#build-integration-1-full-form)
- [Build Integration 2: Redirect handoff](#build-integration-2-redirect-handoff)
- [Build Integration 3: Email-based signup](#build-integration-3-email-based-signup)
- [Verify: schema conformance](#verify-schema-conformance) ← **run before calling any build done**
- [Verify: security and coverage](#verify-security-and-coverage)
- [Guardrails](#guardrails)

---

## Before you start — Required questions

> **STOP. Do not read any reference files, do not open any templates, and do not generate any code until BOTH questions below have been asked and answered by the developer.**

### Question 1 — Which integration variant?

Use AskUserQuestion with exactly these 3 options (no other options, no sequence numbers in labels):

- **Full form (Integration 1)** — You host the entire 6-step merchant signup experience on your site. The merchant completes all steps (1–6) without ever leaving your platform. Each step is proxied to EMAP's API. Requires a backend.
- **Redirect handoff (Integration 2)** — The merchant fills out a single step-1 form on your site. On submit, they are redirected straight into EMAP's onboarding signup flow to complete the remaining steps. No backend required.
- **Email-based signup (Integration 3)** — The merchant fills out a single step-1 form on your site. Your backend submits it to EMAP, which creates their account and sends them a secure resume link by email. The merchant clicks the link and continues the full onboarding flow from their inbox. Requires a backend.

Do not proceed until the developer has chosen one of the three variants.

### Question 2 — Partner key

After the developer has chosen their variant, use AskUserQuestion with exactly these 3 options. The description for each option must include the retrieval instructions exactly as written below — this is what the developer reads to know where to find or get their key:

- **Yes, I have a partner key** — description: "Log in to the partner portal → Integration → API Integration → copy the API key shown there → paste it here."
- **No, I don't have a partner key** — description: "Sign up as a partner at https://emap.easypaydirect.com/signup/partner. Once registered, go to Integration → API Integration → copy the partner key → come back and paste it here."
- **Skip (proceed without a key)** — description: "Signups will still work, but they won't be attributed to your partner account."

**If the developer selects "Yes, I have a partner key":**
Ask them to paste the key now. Store it mentally as `EMAP_PARTNER_KEY`. Proceed to Step 0.

**If the developer selects "No, I don't have a partner key":**
Tell them to follow the sign-up link in the option description above, then come back and paste their key in the chat when ready. Proceed to Step 0 without a key for now — if they paste it later, use it as `EMAP_PARTNER_KEY`.

**If the developer selects "Skip (proceed without a key)":**
Proceed to Step 0 without a partner key.

> **Only after both questions are answered** should you continue to [Step 0](#step-0-detect-project-setup) and begin reading reference files or generating code.

---

## Reference files

Load a reference only when implementing that feature — do not read all upfront.

| File | Read it when… |
|---|---|
| [`signup-steps-schema.json`](signup-steps-schema.json) | **building or verifying ANY form (all 3 integrations)** — the authoritative, machine-readable source for every field's widget `type` (`select`/`radio`/`checkbox-group`/`text`/etc.), option labels (`staticDropdowns`), dynamic dropdown endpoints, and per-country validation (`countryVariants`). **Never infer a widget type or a hardcoded field's option labels from field name or from a markdown table — always resolve them from this file.** |
| [`references/field-catalog.md`](references/field-catalog.md) | building **Integration 2 or 3** — complete field list, types, constraints, and which fields trigger auto-submit. **Not applicable to Integration 1** — its country/industry value formats differ; use `mode-1-fullform.md` and the schema above instead. |
| [`references/mode-1-fullform.md`](references/mode-1-fullform.md) | implementing Integration 1 — all 6-step API contracts, field rules, UUID lifecycle, conditional logic. This file documents API payload/value rules only — it does **not** tell you which HTML widget to render or which validation is per-country; get that from `signup-steps-schema.json`. |
| [`references/mode-2-redirect.md`](references/mode-2-redirect.md) | implementing Integration 2 — URL construction, auto-submit logic, partner attribution, UTM pass-through |
| [`references/mode-3-api.md`](references/mode-3-api.md) | implementing Integration 3 — email-based signup API contract, request/response shapes, resume link, error handling |
| [`references/api-errors.md`](references/api-errors.md) | handling errors — all HTTP status codes, response shapes, and recommended developer actions |
| [`references/security-checklist.md`](references/security-checklist.md) | before going live — all security requirements that must pass |
| [`references/dropdown-fallbacks.json`](references/dropdown-fallbacks.json) | implementing a dropdown-proxy route — static snapshot of every EMAP `/api/partner/*` dropdown response, served when the live call fails or returns no usable data |
| [`verify/SKILL.md`](verify/SKILL.md) | after writing or editing any form/backend file, before calling a build done — how to run [`verify_form.py`](verify/scripts/verify_form.py), what its 4 checks cover, and what it cannot catch |

---

## Step 0: Detect project setup

Before generating any code, answer these questions:

1. **Does the project have a server-side backend?**
   - Yes (Node/Express, PHP, Python, Next.js, etc.) → All three integrations are available.
   - No (static site, client-side only) → **Only Integration 2** is available. Integrations 1
     and 3 require a backend to hold the partner key server-side. If the developer wants
     Integration 1 or 3 on a static site, offer to scaffold a serverless function
     (Vercel, Netlify, Cloudflare Workers).

2. **What framework or language is in use?**
   - Use the matching template from `templates/integration-1/`, `templates/integration-2/`, or `templates/integration-3/`.
   - If no matching template exists, generate code following the pattern in `node-express.js`.

---

## Step 1: Install the verify gate hook

> **STOP. Do not write, edit, or generate a single form/backend file — in a brand-new project or
> an existing one you're continuing — until all 3 steps below are done.** This applies even if
> `merchant-signup/`, templates, or other build output already exist in this project from an
> earlier session: existing code does not mean the hook was ever installed. Check for
> `.claude/hooks/emap_stop_gate.py` first; if it's missing, treat this project as never having
> done Step 1, regardless of what else is already built.
>
> This wires up an automated Stop-hook so a build cannot be silently declared "done" after only
> manual curl/browser testing — it re-runs [`verify_form.py`](verify/scripts/verify_form.py) itself
> (not a self-reported status field) and blocks the session from ending until it actually passes.
> See [Verify: schema conformance](#verify-schema-conformance) for what that script checks.

These 3 steps touch 3 different files and none depends on another's *output* — do them as
**parallel tool calls in the same message** rather than one at a time:

1. **Copy the hook, the script, and a schema snapshot** into the target project's `.claude/hooks/`:
   - [`verify/hooks/emap_stop_gate.py`](verify/hooks/emap_stop_gate.py) → `.claude/hooks/emap_stop_gate.py`
   - [`verify/scripts/verify_form.py`](verify/scripts/verify_form.py) → `.claude/hooks/verify_form.py`
   - [`signup-steps-schema.json`](signup-steps-schema.json) → `.claude/hooks/signup-steps-schema.json`
   All 3 exact contents, byte-for-byte — the hook expects the other two next to it at those exact
   names. Make the hook executable (`chmod +x .claude/hooks/emap_stop_gate.py`).

2. **Register the hook.** Read [`verify/hooks/settings.snippet.json`](verify/hooks/settings.snippet.json)
   and merge its `hooks` key into the target project's `.claude/settings.json`:
   - If `.claude/settings.json` doesn't exist, create it with just that `hooks` key.
   - If it exists but has no `hooks.Stop`, add the `hooks.Stop` array from the snippet.
   - If `hooks.Stop` already has entries, **append** the snippet's single entry to the existing
     array — never overwrite another hook that's already registered there.

3. **Mark the build in progress.** As soon as you start generating code for a chosen integration
   mode, write `.claude/emap-build-state.json`:
   ```json
   { "status": "in_progress", "integration": "1", "form_dir": "merchant-signup" }
   ```
   (use `"2"` or `"3"` to match the mode being built; set `form_dir` to wherever the generated form
   files actually live, relative to the project root — this is what tells the hook where to point
   `verify_form.py`). This is what activates the gate — from this point on, the session cannot Stop
   until a real run of `verify_form.py` passes (the hook checks this itself; see
   [Verify: schema conformance](#verify-schema-conformance)).

**Verify before proceeding:** confirm all 3 files exist under `.claude/hooks/`, the hook is
executable, and `.claude/settings.json` actually contains the `Stop` hook entry — don't just assume
the writes succeeded. This check does have to come *after* the parallel writes above complete. Only
after all 4 files are confirmed on disk should you continue to
[Step 2](#step-2-partner-attribution-optional) or begin generating code.

If the target project cannot run Python 3 (rare), tell the developer the automated gate can't be
installed and that they must run `verify_form.py` manually before accepting the build — do not
skip Step 1 silently.

---

## Step 2: Partner attribution (optional)

Partner attribution links the merchant signup to the partner's account in EMAP.
It is optional — signups work without it, but the partner will not get credit.

- **Integration 2 (redirect):** Pass `secretKey={partner_key}` as a URL query parameter.
  The value is the partner's `security_key` from their EMAP account.
  Store it in the backend environment as `EMAP_PARTNER_SECRET_KEY` and append it server-side.
  Never hardcode it in client-side JavaScript or commit it to source control.

- **Integration 3 (API):** Pass `partner_key` in the JSON request body from your backend.
  Store it as `EMAP_PARTNER_KEY` in your environment. **Never send it to the browser or log it.**

If the developer does not yet have a partner key, refer them back to the instructions in
[Before you start — Required questions](#before-you-start--required-questions).
Integration works without a key; signups will simply not be attributed.

---

## Step 3: Choose integration mode

| | Integration 1 — Full form | Integration 2 — Redirect handoff | Integration 3 — Email-based signup |
|---|---|---|---|
| **How it works** | Partner hosts all 6 steps; backend proxies each step to EMAP API | Partner hosts a single-step form (same fields as Int-1 Step 1); on submit, all fields are appended as URL params and browser redirects to EMAP `/signup?params` | Partner hosts a single-step form; backend POSTs step-1 fields to EMAP REST API; EMAP emails the merchant a secure link to complete their application |
| **Where merchant continues** | Partner's site — all 6 steps | EMAP, from step 2 onward (immediately after redirect) | EMAP, from step 2 onward (after clicking email link) |
| **Backend required?** | Yes — proxies all 6 EMAP API calls | No — redirect is client-side | Yes — `partner_key` must stay server-side |
| **Auto-submit on EMAP?** | N/A — merchant never visits EMAP | Yes, when all non-excluded step-1 fields are provided | N/A — EMAP processes the record server-to-server |
| **Best for** | Full branding control across all 6 steps, enterprise integrations | Simple embed, static sites, fastest integration | Clean partner-side UX for step 1; merchant completes the rest on EMAP after clicking their email link |

Ask the developer which mode they want, or recommend based on their setup from Step 0.

---

## Build Integration 1: Full form

**Before writing any file below:** check that `.claude/hooks/emap_stop_gate.py` exists in this
project. If it doesn't — even if `merchant-signup/` or other build output already exists here —
go do [Step 1](#step-1-install-the-verify-gate-hook) first.

Read [`references/mode-1-fullform.md`](references/mode-1-fullform.md) before proceeding.

> **Build strictly from `signup-steps-schema.json`.** Before writing or porting any field, look it
> up in [`signup-steps-schema.json`](signup-steps-schema.json) and follow it exactly — the widget
> `type`, the API field name/route, every validation rule (including per-country
> `countryVariants`), and every dependent/conditional field (`dependsOn`/`visibleIf`). Do not infer
> any of these from the field name, a markdown table, or prose — the JSON file is the single source
> of truth the form must be built against.

### Steps

1. **Use the template** from `templates/integration-1/`:
   - `node-express.js` — backend that proxies all 6 steps and serves dropdown data.
   - `plain-html.html` — complete 6-step form. Works with the Express backend above.
   - If the project uses a different stack, **port the template 1:1** — same field list, same widget
     type per field, same validation, same conditional logic, same backend routes — rather than
     regenerating the form from the prose reference alone. Use `signup-steps-schema.json` as the
     field-by-field spec while porting.
   - **Don't re-read a template file you've already opened this session** unless you have a
     concrete reason to think it changed on disk since — reuse the content already in context
     instead of paying for a second full read of a 2,000+ line file.

2. **Configure environment variables:**
   ```
   EMAP_BASE_URL=https://emap.epd.dev
   EMAP_PARTNER_KEY=your_key_here   # optional; enables partner attribution
   PORT=3000
   ```

3. **Implement all 6 dropdown-proxy backend routes** (required even on a different stack — a missing
   or misconfigured route is the most common cause of a dropdown rendering with no options):
   ```
   GET /api/countries          → proxies EMAP GET /api/partner/countries
   GET /api/states             → proxies EMAP GET /api/partner/states
   GET /api/industry-types     → proxies EMAP GET /api/partner/industry-types
   GET /api/shopping-carts     → proxies EMAP GET /api/partner/shopping-carts
   GET /api/referral-sources   → proxies EMAP GET /api/partner/referral-sources
   GET /api/interest-details   → proxies EMAP GET /api/partner/interest-details
   ```
   Follow the `dropdownProxy()` pattern in `node-express.js` (same-origin proxy, cache 1 hour, no auth).
   Verify each route actually returns populated `data` before wiring the frontend `<select>` to it.
   **Each route must fall back to the static snapshot in [`references/dropdown-fallbacks.json`](references/dropdown-fallbacks.json)
   when the live EMAP call errors, times out, or returns an empty/missing `data` array** — the
   `node-express.js` template already does this (inlined as `DROPDOWN_FALLBACKS`); port that
   fallback logic along with the rest of the proxy if you're generating a different stack. This is
   what stops a dropdown from silently rendering with zero options when EMAP's dropdown API is
   briefly down or slow.

4. **Understand the step flow:**
   - Step 1 (`POST /api/v1/signup`) returns a `uuid`. Collect: first name, last name, email, phone, company name, website, country, annual sales, **industry type**, and (if US) business state. Store the `uuid` in `localStorage('emap_uuid')`.
   - Steps 2, 3, 5, 6 call `POST /api/v1/application/step` with the `uuid` and the appropriate `step_count`.
   - Step 4 calls `POST /api/v1/ownership` (no `step_count`; uses dot-notation field names).
   - Step 6 success → clear `localStorage` and show a completion panel.

5. **Pre-fill Step 2 from Step 1 data:**
   When Step 1 succeeds and the form advances to Step 2, automatically populate:
   - `legal_name` ← value of `company_name` from Step 1
   - `name` (DBA / "doing business as") ← value of `company_name` from Step 1
   The merchant can edit these fields in Step 2 if the legal name differs from the trading name.
   Only pre-fill when the fields are currently empty (do not overwrite if the merchant has already typed something or if the session was restored from localStorage).

6. **No back-navigation between steps:**
   Once a merchant submits a step successfully, they **cannot** return to a previous step.
   - Do **not** render Back buttons on any step (steps 2–6).
   - Do **not** call `goToStep(n)` with a lower step number from any UI action.
   This is intentional — each step is persisted to EMAP's API on submit, and EMAP does not
   support replaying an earlier step after it has been accepted.

7. **Handle conditional fields:**
   > **`dependsOn` and `visibleIf` can be genuinely different boolean expressions for the same
   > field** — one controls whether the field is *required*, the other whether it's *shown*, and
   > they don't always match. `federal_tax_id` is a real example that has shipped broken twice:
   > an earlier `signup-steps-schema.json` had `visibleIf.logic` hide it only when country=CA
   > **AND** business_organized=Sole-Proprietorship (AND), while `dependsOn.logic` made it
   > non-required when country=CA **OR** business_organized=Sole-Proprietorship (OR) — two
   > different conditions for the same field. That AND was verified against EMAP's own
   > `resources/views/signup/mos/variantA/step2/js.blade.php` (`manageFederalTaxId`) and found
   > stale/wrong: the real form uses the same OR condition for both effects (it never actually
   > hides the field from the DOM — it disables + clears + un-requires it under one OR rule). The
   > schema has since been corrected so `visibleIf` and `dependsOn` agree. The lesson still stands
   > for every other conditional field: **never assume a field's required-effect follows the same
   > expression as its visibility** — read both conditions from `signup-steps-schema.json`
   > separately, and when EMAP's own Blade/JS source for that step is available, cross-check
   > against it rather than trusting either schema field blindly.
   >
   > **Even EMAP's own signup form can disagree with its own API** — this was found the hard way
   > testing the generated form end-to-end against the live API, not just by reading the schema.
   > `federal_tax_id`'s Sole-Proprietorship exemption is real in EMAP's signup UI, but live testing
   > shows **the API requires `federal_tax_id` for a Sole-Proprietorship in every country except
   > Canada**, regardless of what the signup form does: a US and a Germany Sole-Proprietorship both
   > submitted without `federal_tax_id` got a live 422 — `"Federal tax ID (or equivalent) is
   > required for all companies except Canada and Sole-Proprietorships"` — a message that is,
   > ironically, wrong about the very behavior it enforces. A form built to match the signup UI's
   > leniency (hiding/un-requiring the field for any non-CA sole prop) hits that same 422. The same
   > pattern hit `business_register_number`: EMAP's signup form also exempts Puerto Rico and
   > CA+Sole-Proprietorship, but a live Puerto Rico submission without it was rejected too — the API
   > only exempts `US`. **When a schema note and EMAP's own signup form agree with each other, that
   > is not enough confidence — verify against a real POST to the live API before trusting either.**
   - `industry_type` is collected in **Step 1** (not Step 2) and submitted with `POST /api/v1/signup`. Show `industry_type_other` when `industry_type = other`, matched **case-insensitively** — the live `/api/partner/industry-types` endpoint's catch-all slug is `Other` (capitalized), not `other` (step 1).
   - `country=US` → show `business_state` (step 1) and `state.1` (step 4).
   - `emap_country` (Step 1) = `CA` → hide/disable & un-require `federal_tax_id` (step 2). This is the ONLY real exemption — do not also exempt Sole-Proprietorship (see the callout above). Otherwise it's shown, required, and masked per `countryVariants` (see point 9).
   - `emap_country` (Step 1) = `US` → hide/un-require `business_register_number` (step 2). This is the ONLY real exemption — do not also exempt Puerto Rico or CA+Sole-Proprietorship (see the callout above).
   - `is_physical_address_same_as_legal_address=0` → show the physical address block (step 2).
   - `marketingModel` includes `2` → show `subscription_frequency`; if frequency=`3` show `subscription_frequency_other` (step 2).
   - `fulfillment_by` is `Vendor` or `Others` → show `fullfillment_company` (double-l, step 3).
   - `primary_contact=0` → show `first_name.1`, `last_name.1`, `email.1`, `primary_contact_job_title` (step 4).
   - `ownership_percentage.1 < 51` → show Owner 2 section (step 4).
   - `country.1=US` → show `driver_license_state.1` and `driver_license_expiration_date.1` (step 4).
   - `emap_country` (Step 1) = `CA` → show `institution_number` + `customer_pay_currency` (step 5).
   - `bad_experience=true` → show `bad_experience_happened` (step 6).
   - `howdidyouhear` is "Other", "Friend", or "Live Event / Trade Show" → show `hear_about_us_other`
     (step 6). The public `/api/partner/referral-sources` endpoint returns only `name`/`slug` — no
     id — verified against the live API. Match on slug/name text instead (`Other`, `Friend`,
     `Live-Event-/-Trade-Show`); an id-based check can never fire against the partner API and
     silently ships a "tell us more" field that never appears.

8. **Widget type — never guess, always resolve from the schema.** These fields are hardcoded
   value sets, not dynamic dropdown data, and have repeatedly been generated as a `<select>` of
   raw values by mistake. Check `signup-steps-schema.json` for each one's `type` before rendering:
   - `marketingModel` → **checkbox-group** (`staticDropdowns.marketing_model`), not a select. Render
     the `label` text (e.g. "Recurring/Continuity/Subscription"), send the integer `value`.
   - `is_physical_address_same_as_legal_address`, `primary_contact`, `bankruptcy_filed.1/.2`,
     `bankruptcy_discharged.1/.2`, `current_processing`, `bad_experience`,
     `multiple_merchant_accounts`, `leave_deposit` → **radio buttons** (Yes/No), not a select.
   - `terms_and_conditions_agreed` → **checkbox**, not a select.
   - Fields backed by `optionsSource: dynamicDropdownEndpoints.*` (`country`, `industry_type`,
     `shopping_cart`, `howdidyouhear`, etc.) are correctly rendered as `<select>`.

9. **Per-country field validation — must be enforced, not just displayed as a hint.** Read
   `countryVariants` in `signup-steps-schema.json` for these fields and wire the matching
   `maxLength`/`minLength`/`pattern` into both the input's HTML attributes AND a submit-time JS
   check (the same way the SSN mask below is enforced) — a label or placeholder that *says*
   "9 digits" does nothing on its own:
   - `routing_number` — US: exactly 9 digits (`^[0-9]{9}$`).
   - `account_number` — US: 8–17 characters.
   - `federal_tax_id` — numeric-only, masked as `XXX-XX-XXXX` (3-2-4 blocks) for US/CA/PR, or
     `XX-XXXXXXX` (2-7 blocks) for every other country. This is the opposite of what the field's
     generic `^[0-9A-Za-z\-]+$` pattern and "EIN" placeholder might suggest — it is never free-form
     alphanumeric, in any country, even though the label reads "...or Corporation Tax Number
     equivalent" for non-US/CA/PR. Confirmed against `manageFederalTaxIdFormat` in
     `resources/views/signup/mos/variantA/step2/js.blade.php`; see the field's `countryVariants` in
     `signup-steps-schema.json`.
   - `institution_number` — see its `countryVariants`/`pattern` in the schema.

10. **Card percentage (step 3):** `card_swiped + customer_entered + staff_entered` must equal 100.
    Validate client-side and block submission if not.

11. **SSN/SIN (step 4):** For US/CA/PR, apply Cleave.js mask `blocks:[3,2,4] delimiters:["-","-"]`
    to format as `XXX-XX-XXXX`, labelled "SSN/SIN". Validate: `ssn.replace(/-/g,'').length >= 9`.
    For every other country, show a plain, unmasked text field labelled "SSN (or personal Tax ID
    equivalent)" with no format check beyond required.
    > **The country that drives this is `country_from_step1` (the single Step 1 formation
    > country) — the SAME value applied to BOTH Owner 1's `ssn.1` and Owner 2's `ssn.2`.** It is
    > **not** each owner's own `country.1`/`country.2` (their home-address country of residence,
    > which is a separate field used only to gate `driver_license_state.1`/`.2`). Verified against
    > EMAP's own `resources/views/signup/mos/variantA/step4/js.blade.php`: `selectedCountry =
    > "{{ $company->country }}"` is declared once and reused for the Cleave mask applied to every
    > `.owner_ssn` field and for `validateSSN()`, regardless of which owner. A per-owner-country
    > implementation is the exact class of bug bullet 7's `federal_tax_id` warning describes —
    > confirm which field actually drives a country-dependent rule against the live Blade/JS source
    > rather than assuming the "obvious" per-owner field is the right one.
    - Owner 1's SSN (`ssn.1`) is always required. Owner 2's SSN (`ssn.2`) is required only when
      the Owner 2 section is shown (`ownership_percentage.1 < 51`).

12. **DOB (step 4):** Owner must be between 18 and 100 years old.
    `maxDate = today − 18 years`, `minDate = today − 100 years`.
    Enforce this **both client-side** (date input `min`/`max` attributes plus a submit-time check)
    **and server-side** (recompute the owner's age from the submitted date in your `/api/step/4`
    handler before proxying to EMAP) — a client-only check can be bypassed by calling your backend
    directly.

13. **Handle all response shapes** on each step (see [`references/api-errors.md`](references/api-errors.md)):
    - `{"status":true}` → advance to next step.
    - HTTP 422 → display per-field errors.
    - HTTP 429 → ask the merchant to wait and retry.
    - HTTP 5xx → show generic "please try again".

14. **Run `verify_form.py`, not a manual schema-conformance pass.** Do not spot-check individual
    fields by hand against the schema (widget types, hardcoded labels, country-validation patterns,
    conditional show/hide wiring, dropdown routes/fallback) — run
    [`verify_form.py`](verify/scripts/verify_form.py) instead (see
    [Verify: schema conformance](#verify-schema-conformance)) and fix exactly what it reports. That
    check is deterministic and near-instant; re-doing it by hand pays for the same ground twice.
    **This does not replace live testing, though** — the script can only catch a mismatch between
    the schema and the code. It cannot catch the schema and the code agreeing with each other while
    both are wrong relative to the live API, which is a real, documented failure mode (see the
    `federal_tax_id`/`business_register_number` callout in point 7, and "What this script cannot
    catch" in `verify/SKILL.md`). Once `verify_form.py` passes, still submit at least one live
    6-step signup for a representative edge case (e.g. a non-CA Sole-Proprietorship) before telling
    the developer the build is done.
    - **Run the [Verify: schema conformance](#verify-schema-conformance) step**, then
      [Verify: security and coverage](#verify-security-and-coverage), before telling the developer
      the form is done. The verify gate hook (Step 1) will block the session from ending until
      `verify_form.py` actually passes.


---

## Build Integration 2: Redirect handoff

**Before writing any file below:** check that `.claude/hooks/emap_stop_gate.py` exists in this
project. If it doesn't — even if `merchant-signup/` or other build output already exists here —
go do [Step 1](#step-1-install-the-verify-gate-hook) first.

Read [`references/mode-2-redirect.md`](references/mode-2-redirect.md) before proceeding.

> **Build strictly from `signup-steps-schema.json`.** Before writing any field, look it up in
> [`signup-steps-schema.json`](signup-steps-schema.json) and follow it exactly — the widget `type`,
> the API field name, every validation rule (including per-country `countryVariants`), and every
> dependent/conditional field (`dependsOn`/`visibleIf`). Do not infer any of these from the field
> name, a markdown table, or prose — the JSON file is the single source of truth the form must be
> built against.

### Overview

Integration 2 is a **single-step form** — it collects exactly the same fields as Integration 1
Step 1 (basic merchant info). There is **no Terms and Conditions checkbox**. On submit, all form
fields are serialized as URL query parameters and the browser redirects to
`{EMAP_BASE_URL}/signup?{params}`. EMAP reads the params, prefills its form, and either shows
the form to the merchant or auto-submits it (if all auto-submit fields are present), landing the
merchant directly on step 2.

### Fields collected (same as Integration 1 Step 1)

| Field | Type | Notes |
|---|---|---|
| `first_name` | text | Required |
| `last_name` | text | Required |
| `email` | email | Required |
| `phone` | tel | Required |
| `company_name` | text | Required |
| `website` | url | Required |
| `country` | select | Required — pass **full country name** (e.g. `United States`), not a 2-char code |
| `business_state` | select | Required only when `country = United States` |
| `annual_sales` | number | Required |
| `industry_type` | select | Required — loaded from EMAP API (`/api/partner/industry-types`), use `name` as value |
| `industry_type_other` | text | Conditional — shown when `industry_type = Other` |
| `promo_code` | text | Optional |

**No T&C checkbox.** Do not add one — the merchant agrees to terms on EMAP after step 6.

### Steps

1. **Use the template** from `templates/integration-2/` matching the project stack.
   - No backend: use `plain-html.html` — client-side form that builds and follows the redirect URL.
   - Has backend: use `node-express.js` — server builds the URL and returns it to the client,
     keeping `EMAP_PARTNER_SECRET_KEY` out of the browser.

2. **On submit — build redirect URL:**
   ```javascript
   const params = new URLSearchParams();
   params.set('first_name', formData.get('first_name'));
   params.set('last_name',  formData.get('last_name'));
   params.set('email',      formData.get('email'));
   params.set('phone',      formData.get('phone'));
   params.set('company_name', formData.get('company_name'));
   params.set('website',    formData.get('website'));
   params.set('country',    formData.get('country'));       // full name
   if (formData.get('business_state')) params.set('business_state', formData.get('business_state'));
   params.set('annual_sales', formData.get('annual_sales'));
   params.set('industry_type', formData.get('industry_type'));
   if (formData.get('promo_code'))    params.set('promo_code', formData.get('promo_code'));
   // UTM pass-through (see step 3)
   window.location.href = EMAP_BASE_URL + '/signup?' + params.toString();
   ```

3. **Pass UTM params through.** Read `utm_campaign`, `utm_source`, `utm_medium`, `utm_term`,
   `utm_content`, `gclid`, `gbraid`, `wbraid` from the current page URL and append them to the
   redirect URL. The templates do this automatically.

4. **Configure environment variables:**
   ```
   EMAP_BASE_URL=https://emap.epd.dev
   EMAP_PARTNER_SECRET_KEY=your_key_here   # optional; enables partner attribution
   ```

5. **Set `Referrer-Policy: no-referrer`** on your form page. This prevents the EMAP URL
   (which contains PII in the query string) from leaking into the `Referer` header sent to
   third-party analytics on the EMAP page.

6. **Test:**
   - Partial prefill: pass `first_name`, `last_name`, `company_name`, `phone`, `email` only.
     EMAP shows the form prefilled; the merchant fills in the rest manually.
   - Full prefill (auto-submit): pass all non-excluded fields. EMAP auto-submits; merchant
     lands on step 2. See [`references/mode-2-redirect.md`](references/mode-2-redirect.md).
   - **Run `verify_form.py --integration 2`** (see
     [Verify: schema conformance](#verify-schema-conformance)), then
     [Verify: security and coverage](#verify-security-and-coverage), before telling the developer
     the form is done. The manual testing above does not substitute for either — the verify gate
     hook (Step 1) will block the session from ending until `verify_form.py` actually passes.


---

## Build Integration 3: Email-based signup

**Before writing any file below:** check that `.claude/hooks/emap_stop_gate.py` exists in this
project. If it doesn't — even if `merchant-signup/` or other build output already exists here —
go do [Step 1](#step-1-install-the-verify-gate-hook) first.

Read [`references/mode-3-api.md`](references/mode-3-api.md) before proceeding.

> **Build strictly from `signup-steps-schema.json`.** Before writing any field, look it up in
> [`signup-steps-schema.json`](signup-steps-schema.json) and follow it exactly — the widget `type`,
> the API field name, every validation rule (including per-country `countryVariants`), and every
> dependent/conditional field (`dependsOn`/`visibleIf`). Do not infer any of these from the field
> name, a markdown table, or prose — the JSON file is the single source of truth the form must be
> built against.

### Steps

1. **Create the form.** Use the field list in [`references/field-catalog.md`](references/field-catalog.md)
   (Integration 3 columns). Note: the API uses `name` for company name, not `company_name`.

2. **Create a backend endpoint** (e.g. `POST /api/signup`) that:
   - Receives and validates the form data server-side.
   - Reads `EMAP_PARTNER_KEY` and `EMAP_BASE_URL` from the environment.
   - Calls `POST {EMAP_BASE_URL}/api/v1/signup` with the validated data plus `partner_key` and
     `trigger_email: true`. This flag tells EMAP to dispatch the welcome/verification email as
     part of this same call — without it, the account is created but no email is sent.
   - Returns the EMAP response (or a mapped version) to the browser.
   Use the matching template from `templates/integration-3/`.

3. **Configure environment variables:**
   ```
   EMAP_BASE_URL=https://emap.epd.dev
   EMAP_PARTNER_KEY=your_key_here   # never commit this
   ```

4. **Handle all response shapes** on the client side (see
   [`references/api-errors.md`](references/api-errors.md) for the full table):
   - `{"status":true,"uuid":"..."}` → show "Application submitted! Check your inbox."
   - `{"verificationLink":true,"url":"..."}` → existing user; show message or redirect to `url`.
   - `{"status":false,"message":"Company already exists"}` → tell merchant to check their email.
   - HTTP 422 → display per-field errors from `response.errors`.
   - HTTP 429 → tell merchant to wait and retry.

5. **Test** by submitting with a unique email. Verify `{"status":true,"uuid":"..."}` is returned
   and the welcome email arrives.
   - **Run `verify_form.py --integration 3`** (see
     [Verify: schema conformance](#verify-schema-conformance)), then
     [Verify: security and coverage](#verify-security-and-coverage), before telling the developer
     the form is done. The manual testing above does not substitute for either — the verify gate
     hook (Step 1) will block the session from ending until `verify_form.py` actually passes.


---

## Verify: schema conformance

Run [`verify_form.py`](verify/scripts/verify_form.py) against the generated form — a deterministic
script, no LLM reading involved — instead of spot-checking fields by hand against
`signup-steps-schema.json`. Full details, the loop to follow, what each of its 4 categories checks,
and — importantly — what it structurally cannot catch (some bugs need a real live-API test, not
just a schema-vs-code diff) are in [`verify/SKILL.md`](verify/SKILL.md). If Step 1's hook is
installed, the session cannot Stop until a real run of the script passes — see that file for the
full loop (fix → scoped re-run → repeat, capped at 5 rounds).

---

## Verify: security and coverage

Before going live, run through [`references/security-checklist.md`](references/security-checklist.md).

Quick self-check — **[Verify: schema conformance](#verify-schema-conformance) above checks schema
conformance only; it does not check deployment/config wiring, so the last two items here need a
manual look, not just a clean `verify_form.py` run**:
- [ ] HTTPS on your site — form page and backend endpoint.
- [ ] Partner key in env only — not in client-side code, not in the form HTML, not in git.
- [ ] `Referrer-Policy: no-referrer` on the form page (critical for Integration 2).
- [ ] Backend validation before forwarding to EMAP.
- [ ] Submit button disabled on first click (double-submit prevention).
- [ ] Generic user-facing errors — do not expose EMAP's raw error messages.
- [ ] **Config actually loads for this stack.** If you wrote a `.env` file, confirm the backend
  genuinely reads it — e.g. PHP has no built-in dotenv support; bare `getenv()`/`$_ENV` will never
  see a `.env` file without an explicit loader or server-level `SetEnv`. Test by clearing any
  shell/process-level env vars and confirming `EMAP_BASE_URL`/`EMAP_PARTNER_KEY` still resolve.
- [ ] **Dropdown-fallback file is actually deployed and reachable.** If the backend falls back to
  `dropdown-fallbacks.json` on API failure, confirm that file exists alongside the *deployed* backend
  (not just in this skill's `references/` folder) and that the fallback code path is genuinely
  called on a simulated failure, not merely defined and never invoked.

---

## Guardrails

**Never print, log, commit, or send to the browser the partner key (`EMAP_PARTNER_KEY` / `EMAP_PARTNER_SECRET_KEY`).**
**Never call EMAP's API (`/api/v1/signup`) directly from browser-side JavaScript — always go through your backend.**
**Never store PII (name, email, phone) in your database after forwarding to EMAP — EMAP is the system of record.**
**Never add document upload fields — EMAP collects documents in its own UI after step 6.**
**Do not modify field validation rules — EMAP will reject submissions that don't pass its server-side rules.**
