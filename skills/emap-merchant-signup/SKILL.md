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
- [Step 0.5: Install the verify gate hook](#step-05-install-the-verify-gate-hook) ← **do this before writing any code**
- [Step 1: Partner attribution (optional)](#step-1-partner-attribution-optional)
- [Step 2: Choose integration mode](#step-2-choose-integration-mode)
- [Build Integration 1: Full form](#build-integration-1-full-form)
- [Build Integration 2: Redirect handoff](#build-integration-2-redirect-handoff)
- [Build Integration 3: Email-based signup](#build-integration-3-email-based-signup)
- [Verify loop: schema conformance](#verify-loop-schema-conformance) ← **run before calling any build done**
- [Verify: security and coverage](#verify-security-and-coverage)
- [Guardrails](#guardrails)

---

## Before you start — Required questions

> **STOP. Do not read any reference files, do not open any templates, and do not generate any code until BOTH questions below have been asked and answered by the developer.**

### Question 1 — Which integration variant?

Use AskUserQuestion with exactly these 3 options (no other options, no sequence numbers in labels):

- **Redirect handoff (Integration 2)** — The merchant fills out a single step-1 form on your site. On submit, they are redirected straight into EMAP's onboarding signup flow to complete the remaining steps. No backend required.
- **Full form (Integration 1)** — You host the entire 6-step merchant signup experience on your site. The merchant completes all steps (1–6) without ever leaving your platform. Each step is proxied to EMAP's API. Requires a backend.
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

## Step 0.5: Install the verify gate hook

> **STOP. Do not write, edit, or generate a single form/backend file — in a brand-new project or
> an existing one you're continuing — until all 3 steps below are done.** This applies even if
> `merchant-signup/`, templates, or other build output already exist in this project from an
> earlier session: existing code does not mean the hook was ever installed. Check for
> `.claude/hooks/emap-verify-gate.py` first; if it's missing, treat this project as never having
> done Step 0.5, regardless of what else is already built.
>
> This wires up an automated Stop-hook so a build cannot be silently declared "done" after only
> manual curl/browser testing — it forces the [Verify loop](#verify-loop-schema-conformance) to
> actually run and pass before the session can end.

These 3 steps touch 3 different files and none depends on another's *output* (step 3's content is
fixed regardless of what 1/2 wrote) — do them as **parallel tool calls in the same message** rather
than one at a time:

1. **Copy the hook script.** Create `.claude/hooks/emap-verify-gate.py` in the target project
   with the exact contents of [`hooks/emap-verify-gate.py`](hooks/emap-verify-gate.py) from this
   skill. Make it executable (`chmod +x .claude/hooks/emap-verify-gate.py`).

2. **Register the hook.** Read [`hooks/settings.snippet.json`](hooks/settings.snippet.json) and
   merge its `hooks` key into the target project's `.claude/settings.json`:
   - If `.claude/settings.json` doesn't exist, create it with just that `hooks` key.
   - If it exists but has no `hooks.Stop`, add the `hooks.Stop` array from the snippet.
   - If `hooks.Stop` already has entries, **append** the snippet's single entry to the existing
     array — never overwrite another hook that's already registered there.

3. **Mark the build in progress.** As soon as you start generating code for a chosen integration
   mode, write `.claude/emap-build-state.json`:
   ```json
   { "status": "in_progress", "integration": "1" }
   ```
   (use `"2"` or `"3"` to match the mode being built). This is what activates the gate — from this
   point on, the session cannot Stop until the file is updated to `"status": "verified"` by a
   passing run of the [Verify loop](#verify-loop-schema-conformance) (or to `"blocked"` /
   `"cancelled"` — see the Verify loop section for when those apply).

**Verify before proceeding:** confirm `.claude/hooks/emap-verify-gate.py` exists, is executable,
and `.claude/settings.json` actually contains the `Stop` hook entry — don't just assume the writes
succeeded. This check does have to come *after* the parallel writes above complete. Only after all
3 files are confirmed on disk should you continue to [Step 1](#step-1-partner-attribution-optional)
or begin generating code.

If the target project cannot run Python 3 (rare), tell the developer the automated gate can't be
installed and that they must run the Verify loop manually before accepting the build — do not
skip Step 0.5 silently.

---

## Step 1: Partner attribution (optional)

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

## Step 2: Choose integration mode

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

**Before writing any file below:** check that `.claude/hooks/emap-verify-gate.py` exists in this
project. If it doesn't — even if `merchant-signup/` or other build output already exists here —
go do [Step 0.5](#step-05-install-the-verify-gate-hook) first.

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

14. **No manual test pass — go straight to the automated loop.** Do not run any manual
    curl/browser test scenarios here (not a smoke run of the 6 steps, not a spot-check of any
    field, none of it) — every one of those either duplicates a check the Verify loop already runs
    independently and more rigorously (widget types, hardcoded labels, country validation,
    conditional/back-nav logic, dropdown routes/fallback), or is a correctness question the loop
    will surface through its `[]`-or-findings result regardless. Skipping straight there removes an
    entire redundant pass instead of paying for the same ground twice.
    <!-- - **Run the [Verify loop: schema conformance](#verify-loop-schema-conformance)**, then
      [Verify: security and coverage](#verify-security-and-coverage), before telling the developer
      the form is done. The verify gate hook (Step 0.5) will block the session from ending until
      the loop has completed with zero `CONFIRMED` findings. -->


---

## Build Integration 2: Redirect handoff

**Before writing any file below:** check that `.claude/hooks/emap-verify-gate.py` exists in this
project. If it doesn't — even if `merchant-signup/` or other build output already exists here —
go do [Step 0.5](#step-05-install-the-verify-gate-hook) first.

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
   <!-- - **Run the [Verify loop: schema conformance](#verify-loop-schema-conformance)** and then
     [Verify: security and coverage](#verify-security-and-coverage) before telling the developer
     the form is done. Manual testing above does not substitute for either — the verify gate hook
     (Step 0.5) will block the session from ending until the loop has completed with zero
     `CONFIRMED` findings. -->


---

## Build Integration 3: Email-based signup

**Before writing any file below:** check that `.claude/hooks/emap-verify-gate.py` exists in this
project. If it doesn't — even if `merchant-signup/` or other build output already exists here —
go do [Step 0.5](#step-05-install-the-verify-gate-hook) first.

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
   <!-- - **Run the [Verify loop: schema conformance](#verify-loop-schema-conformance)** and then
     [Verify: security and coverage](#verify-security-and-coverage) before telling the developer
     the form is done. Manual testing above does not substitute for either — the verify gate hook
     (Step 0.5) will block the session from ending until the loop has completed with zero
     `CONFIRMED` findings. -->


---

<!--
## Verify loop: schema conformance

> **Definition of done.** A build is not done until this loop has completed with zero `CONFIRMED`
> findings. Your final response to the developer must include the verify agents' raw findings
> JSON from the last round (or explicitly state it returned `[]`) — not a paraphrase, not a
> summary of manual testing you did instead. If Step 0.5's hook is installed, the session cannot
> Stop until `.claude/emap-build-state.json` says `"status": "verified"` (see step 7 below) —
> treat that as the actual finish line for the build, not your own judgment that it "looks done."

> **Performance target.** When the build agent used the matching template verbatim (see "Use the
> template" in each Build section) instead of regenerating from prose, round 1 below *should* return
> `[]` or close to it, and the whole loop — build through `"status": "verified"` — should complete
> in well under 10 minutes. Regenerating the form/backend from the reference docs instead of copying
> the template means more rounds; only do that when the project's stack has no matching template.
> This assumes the template itself is currently clean — see "Recurring template defects" below for
> what to do when a verbatim copy still produces real findings.

Do this for **every** integration mode, after the form and backend are written and before you tell
the developer the build is done. Its purpose is to catch the exact class of bug this skill has
shipped before: a rule that exists in `signup-steps-schema.json` (or `field-catalog.md` for Int 2/3)
but wasn't actually wired into the generated code — a `<select>` used where a checkbox-group was
required, a country-specific length limit shown as a hint but not enforced, a dropdown wired to a
proxy route that doesn't return data, etc. Do not rely on having "read the schema earlier" — the
generated code is the thing being graded, not your memory of the instructions.

**Roles** — four, not two. A single verify agent's own findings are not trustworthy enough to act
on directly (it can hallucinate a mismatch or misread the schema); they must be independently
confirmed before anyone spends a fix cycle on them. And once findings are confirmed, applying them
is itself parallelizable — it doesn't have to be the build agent doing every fix serially.

1. **Build agent** — you. Coordinates the loop, writes the initial code. Never grades its own
   output, and — once there's more than one file to fix — delegates the actual fixing (see "Fix
   agents" below) rather than doing every file itself in sequence.
2. **Verify agents** (fresh `general-purpose` agents, **4 spawned in parallel per round** — see
   "Category split" below) — each reads only its own slice of the schema/reference docs and the
   generated files, and proposes findings for that slice only. Proposes only — does not decide
   what's real.
3. **Confirm agent** (fresh agent **per individual finding, or per small cluster of findings that
   share the same category and bug pattern** — see "Clustering confirm agents" below — spawned in
   parallel, on the fastest available model — see "Confirm agent model" below) — independently
   re-derives each finding from the primary source (the exact schema field and the exact file/line
   cited) without trusting the verify agent's description of it, and returns a verdict per finding.
   Only `CONFIRMED` findings ever reach the build agent.
4. **Fix agent** (fresh agent **per distinct file with confirmed findings**, spawned in parallel —
   see step 8 in the Loop below) — applies every confirmed finding scoped to its one file. Two fix
   agents never touch the same file at once (that's the one real constraint on parallelizing this
   step); different files have no such conflict, so there's no reason to fix them one at a time.

**Category split.** Instead of one verify agent reading the entire schema and every generated file
for all 5 checks, split the same 5 checks across 4 agents spawned **in a single message** so they
run concurrently — this is the main lever for wall-clock time, since the checks are independent of
each other and each agent now only has to read the fields relevant to its own category:

| Agent | Category | Checks |
|---|---|---|
| A | `widget_type` + `hardcoded_label` | rendered widget matches schema `type`; `staticDropdowns` fields render the label, not the raw `value`/`slug` |
| B | `country_validation` | every `countryVariants` constraint (`pattern`/`exactLength`/`minLength`/`maxLength`) is enforced in actual validation code, not just shown as a hint |
| C | `conditional_logic` | every `dependsOn`/`visibleIf` conditional is implemented, the shown/hidden field's required/optional state matches, **and** no Back button/`goToStep(n)`-to-a-lower-step exists on any step (SKILL.md's no-back-navigation rule) |
| D | `dropdown_route` | all 6 dropdown-proxy routes return non-empty data for a live test country, and fall back to `references/dropdown-fallbacks.json` when the live call fails |

For Integration 1, steps 7–9 of "Build Integration 1" already enumerate the exact field list for
categories B, C, and the widget-type list in A — point each agent at that enumerated list instead of
telling it to scan the whole schema for candidates. For Integration 2/3, derive the equivalent field
list from `field-catalog.md` before spawning.

**Split an oversized category further.** 4 parallel agents only run as fast as the slowest one — if
a category's field list is large, that one agent becomes the long pole while the other 3 finish and
sit idle waiting on it. Field *count* alone is a weak proxy for how long a category takes:
`conditional_logic` checks 3 things per field (visibility trigger, required-toggle, presence-check)
where `country_validation` checks essentially 1 (the constraint is enforced), so it runs ~3x heavier
per field — in practice it's been the long pole even at ~22 fields, well under a naive "25+" cutoff.
So: **always split `conditional_logic` into 2 sub-agents by step range** (e.g. steps 1–3 vs 4–6) for
Integration 1 regardless of field count; for the other categories, use the ~25-field rule of thumb.
Run all sub-agents in parallel alongside A/B/D, and merge their findings — same `category` value on
both, just half the field list each.

**Steps 4–6 stays the long pole even after the step-range split.** In practice, the steps 4–6 half
(~17 fields: primary-contact fields, driver-license fields for both owners, bankruptcy history,
SSN/DOB, banking) has been the single slowest verify agent in every round of every real run so far —
heavier than steps 1–3 despite the even step-count split, because it clusters almost all the
owner/ownership conditional logic in one place. When it's still the long pole after the 1–3/4–6
split, split it a second time by field-type group instead of step-count: (a) primary-contact +
driver-license fields, (b) bankruptcy + SSN/DOB fields, (c) banking fields (institution_number /
customer_pay_currency). Run all sub-agents alongside the rest, same `category` value on each, merge
their findings.

**Pre-slice the schema before spawning — don't make the agent filter it.** Before round 1, extract
each category's relevant entries from `signup-steps-schema.json` into a small temp file per category
(a `jq`/grep one-liner against the enumerated field lists above, saved under the scratchpad) and hand
each verify agent that slice's path instead of the full ~2,000-line schema. This is strictly faster
than handing over the whole file and trusting the agent to skim to the right entries — it's a few
seconds of build-agent work that saves each of the 4 agents from reading everything else.

**Confirm agent model.** Confirm agents do a narrow, deterministic lookup (does field X in the code
match rule Y in the schema) — this doesn't need a heavyweight model. Spawn confirm agents with a
fast/lightweight model override (e.g. `model: "haiku"`) rather than the default. Keep verify agents
(categories A–D) on the default model — judging "does this conditional logic actually match the
spec" benefits from more reasoning than a single-fact lookup does.

**Clustering confirm agents.** Strict one-agent-per-finding is safe but not always necessary — when
several findings in the same round share the same category *and* the same underlying bug pattern
(e.g. six `physical_address_*` fields all missing the identical required-toggle-on-visibility-change
bug, or four `bankruptcy_discharged*` fields all missing the same submit-time check), spawn one
confirm agent per cluster instead of one per field, and have it return a JSON array of verdicts (one
per field) rather than a single verdict. Each field in the cluster must still be independently
re-derived from its own primary-source schema entry — the agent is checking N fields, not
rubber-stamping one check across N labels. In practice this has roughly halved confirm-phase agent
count with no observed loss of accuracy (every clustered `CONFIRMED` verdict was later independently
re-confirmed clean in the next round's re-audit). Don't cluster findings from different categories or
different bug patterns into one agent — the savings only apply when the check is genuinely the same
shape repeated across fields.

**Findings contract.** Each verify agent must return a JSON array — not prose — each item shaped as:
```json
{
  "file": "relative/path/to/file",
  "field": "schema field key, or 'route:/api/countries', or 'storage:emap_uuid'",
  "category": "widget_type | hardcoded_label | country_validation | conditional_logic | dropdown_route | other",
  "expected": "what signup-steps-schema.json / field-catalog.md says",
  "actual": "what the generated code actually does, with a line reference",
  "severity": "blocker | minor"
}
```
An empty array (`[]`) is a valid, expected result — do not treat "I found nothing" as a failure to
justify by inventing an item.

**Loop:**

1. **Build agent** finishes the form + backend for the chosen integration mode.
2. **Round 1 only — full audit.** Build agent extracts the 4 pre-sliced scope files (see "Pre-slice
   the schema" above), then spawns **all 4 category verify agents in parallel** (single message,
   multiple Agent tool calls), each with this brief: *"Read `<pre-sliced schema-scope file for this
   category>` — this is already filtered to the fields relevant to `<category>`, you do not need to
   open the full `signup-steps-schema.json`. Read the generated form/backend files at `<paths>`.
   Check only: `<the one check row for this category from the table above>`. Return findings
   strictly as the JSON array defined in the Findings contract above, `category` fixed to
   `<category>` — no prose, no markdown. Return `[]` if none exist — do not invent findings to
   justify the pass."*
3. **Rounds 2–5 — scoped re-audit.** After a fix, spawn only the category agent(s) whose fields were
   touched by that fix (still parallel if more than one), using the same pre-sliced scope file. This
   is a deliberate speed/rigor trade-off: a fix could in principle regress a field outside the
   categories re-run — accept that risk in exchange for not re-reading everything every round. If you
   want the stricter behavior instead, run all 4 categories on every round.
4. **Merge** all returned findings arrays into one list. **If the merged list is empty, skip straight
   to step 7** (there is nothing to confirm).
5. **Build agent spawns one confirm agent per finding, in parallel**, on the fast/lightweight model
   (see "Confirm agent model" above). Extract the finding's exact schema entry (a single `jq`/grep
   lookup by `field`, cheap since you already know the field name) and paste it verbatim into the
   brief, so the confirm agent doesn't have to open the full schema file for a one-field check: *"A
   verify agent claims: `<the single finding JSON>`. Do not trust the verify agent's description —
   independently open `<file>` at the cited location and check it yourself. Here is the exact,
   unedited entry for `<field>` from `signup-steps-schema.json` (or `field-catalog.md`), copied
   verbatim — treat it as the primary source, not the verify agent's `expected`/`actual` summary:
   `<literal JSON excerpt>`. Decide from these primary sources only: is this finding real? Return
   `{finding, verdict: "CONFIRMED" | "REJECTED", reason}`."*
6. **Build agent keeps only `CONFIRMED` findings**, discards `REJECTED` ones (a rejected finding is
   not reported to the developer and is not a reason to loop again).
7. **If there are zero `CONFIRMED` findings** → conformance passed. If Step 0.5's hook is
   installed, write `.claude/emap-build-state.json`:
   ```json
   { "status": "verified", "integration": "1", "rounds": 1, "confirmed_findings": [] }
   ```
   (match `integration` and `rounds` to what actually happened). Then proceed to
   [Verify: security and coverage](#verify-security-and-coverage), then hand off to the developer.
8. **If there is at least one `CONFIRMED` finding** → group the confirmed findings by `file`, then
   **spawn one fix agent per distinct file, in parallel** (never two agents on the same file at
   once — that's the only real constraint; different files don't conflict). Each fix agent's brief:
   *"Apply every one of these confirmed findings to `<file>`: `<that file's confirmed findings>`.
   Change the code directly for each — do not just re-read the docs and re-explain the rule."*
   - **File-level splitting alone doesn't help when findings are lopsided.** If most confirmed
     findings for this round land in one file (rule of thumb: one file holds more than ~60–70% of
     the round's total), splitting "by file" just means one agent does almost everything while the
     other finishes early and idles. When that happens, split *that file's* findings further into 2
     fix agents by non-overlapping region (e.g. by step number, so each agent's edits land in
     different functions/sections of the same file) instead of handing them all to one agent.
   - **Do not curl-test or manually re-verify each fix as you apply it.** That duplicates the
     scoped re-audit you're about to run in step 3 — paying for the same check twice. At most, run
     one syntax/lint check per file (e.g. `node -c`, `php -l`) after all of that file's fixes are
     in, to catch a typo before spawning verify agents again; the actual correctness check is the
     next round's re-audit, not a manual pass here.
   - Once every fix agent returns, go to step 3 (scoped re-audit) for the next round.
9. **Cap at 5 verify→confirm→fix rounds.** If `CONFIRMED` findings remain after 5 rounds, stop
   looping, report exactly those remaining `CONFIRMED` findings to the developer, and do not claim
   the build is done. If Step 0.5's hook is installed, write `.claude/emap-build-state.json` with
   `"status": "blocked"` (not `"verified"`) plus the remaining findings, so the gate reflects that
   the loop ran to its cap rather than was skipped:
   ```json
   { "status": "blocked", "integration": "1", "rounds": 5, "confirmed_findings": [ /* ... */ ] }
   ```

**Abandoning a build.** If the developer decides to stop partway through — not "done", just no
longer wanted — write `{"status": "cancelled", "integration": "<n>"}` to
`.claude/emap-build-state.json` rather than leaving it `"in_progress"` (which would leave the Stop
hook blocking forever) or deleting/hand-editing it to fake a pass.

**Recurring template defects.** If round 1 comes back with `CONFIRMED` findings despite the build
agent having copied the matching template **verbatim** (not ported, not regenerated from prose),
those findings are not this build's mistake — they're defects shipped in the template itself, and
every future build that copies the same template will rediscover and re-pay the exact same
verify→confirm→fix cost. Don't just fix the local copy and move on silently: tell the developer
explicitly that the findings look like a template-level defect (name the template file), so it can
be patched upstream in `templates/` rather than re-fixed from scratch on every future build.
-->

---

## Verify: security and coverage

Before going live, run through [`references/security-checklist.md`](references/security-checklist.md).

Quick self-check — **the verify loop above (categories A–D) checks schema conformance only; it does
not check deployment/config wiring, so the last two items here need a manual look, not just a clean
loop result**:
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
