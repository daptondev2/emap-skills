---
name: emap-merchant-signup
description: >-
  Guides a partner building an EMAP merchant-signup form on their own
  website, in any tech stack (React/Next.js, Vue/Nuxt, Angular, Svelte,
  PHP/WordPress, Rails, Django, ASP.NET, static sites, site builders).
  Every EMAP API call is made from the merchant's browser, never from the
  partner's server, so EMAP can rate-limit by the merchant's real IP.
  Covers Integration 1 (full form —
  all 6 signup steps hosted on the partner site), Integration 2 (redirect
  handoff — browser redirects to EMAP with step-1 data in URL params, EMAP
  prefills its form and submits it for the merchant when the data passes its
  validation), and Integration 3 (email-based signup —
  step-1 data is POSTed directly to EMAP's REST API from the browser, EMAP
  creates the record and emails the merchant a secure link to complete their
  full application). Provides field references, code templates, and a
  security checklist.
---

# Merchant Signup Integration

A developer guide for embedding an EMAP merchant signup form on a partner website.
The merchant fills in their basic business information on the **partner's site**;
EMAP handles all subsequent steps (company details, banking, e-signature) — or,
with Integration 1, the partner hosts all 6 steps themselves.

**Contents**
- [Before you start — Required questions](#before-you-start--required-questions) ← **start here, always**
- [Reference files](#reference-files) — load only when implementing that feature
- [Step 0: Detect the project's stack](#step-0-detect-the-projects-stack)
- [Step 1: Install the verify gate](#step-1-install-the-verify-gate) ← **do this before writing any code**
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

> **STOP. Do not read any reference files, do not open any templates, and do not generate any code until the two questions below have been asked and answered by the developer.** These are the only two questions to ask up front; ask about the stack only if [Step 0](#step-0-detect-the-projects-stack) can't detect it.

### Question 1 — Which integration variant?

Ask the developer to pick one of exactly these 3 options, and no others. If your agent has a multiple-choice question tool, use it, with the bold text as each option's label and the rest as its description (no sequence numbers in labels). Otherwise, ask in plain text as a numbered list and wait for the answer.

- **Full form (Integration 1)** — You host the entire 6-step merchant signup experience on your site. The merchant completes all steps (1–6) without ever leaving your platform. Each step is POSTed directly from the browser to EMAP's API. Works in any stack; EMAP is called from the merchant's browser.
- **Redirect handoff (Integration 2)** — The merchant fills out a single step-1 form on your site. On submit, they are redirected straight into EMAP's onboarding signup flow to complete the remaining steps. Works in any stack; EMAP is called from the merchant's browser.
- **Email-based signup (Integration 3)** — The merchant fills out a single step-1 form on your site, which POSTs it directly to EMAP from the browser. EMAP creates their account and sends them a secure resume link by email. The merchant clicks the link and continues the full onboarding flow from their inbox. Works in any stack; EMAP is called from the merchant's browser.

Do not proceed until the developer has chosen one of the three variants.

### Question 2 — Partner key

After the developer has chosen their variant, ask them to pick one of exactly these 3 options, the same way as Question 1 (a multiple-choice question tool if your agent has one, otherwise a numbered list in plain text). The description for each option must include the retrieval instructions exactly as written below — this is what the developer reads to know where to find or get their key. Also tell them, before they answer: **EMAP is called from the merchant's browser, so the key will be embedded directly in the page's JavaScript and visible to anyone who views the page source.** EMAP treats it purely as an attribution/referral value (not a credential that grants access to anything), so the practical risk of exposure is another site's signups being mis-attributed to this key, not a security breach — but they should know that before deciding.

- **Yes, I have a partner key** — description: "Log in to the partner portal → Integration → API Integration → copy the API key shown there → paste it here."
- **No, I don't have a partner key** — description: "Sign up as a partner at https://emap.easypaydirect.com/signup/partner. Once registered, go to Integration → API Integration → copy the partner key → come back and paste it here."
- **Skip (proceed without a key)** — description: "Signups will still work, but they won't be attributed to your partner account. Choose this if you'd rather not have the key visible in your page's source."

**If the developer selects "Yes, I have a partner key":**
Ask them to paste the key now. Remember it as `EMAP_PARTNER_KEY` — you'll write it directly into the `EMAP_PARTNER_KEY` constant in the generated file(s) later. Proceed to Step 0.

**If the developer selects "No, I don't have a partner key":**
Tell them to follow the sign-up link in the option description above, then come back and paste their key when ready. Proceed to Step 0 without a key for now — if they paste it later, write it into the `EMAP_PARTNER_KEY` constant in the generated file(s).

**If the developer selects "Skip (proceed without a key)":**
Proceed to Step 0 without a partner key.

> **Only after both questions are answered** should you continue to [Step 0](#step-0-detect-the-projects-stack) and begin reading reference files or generating code.

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
| [`references/stack-guide.md`](references/stack-guide.md) | Step 0: delivering the form in the project's stack. Covers stack detection, React / Vue / Angular / Svelte / server-rendered / static / site-builder / mobile delivery, native-port rules, and which server-side code must never call EMAP |
| [`references/security-checklist.md`](references/security-checklist.md) | before going live — all security requirements that must pass |
| [`references/dropdown-fallbacks.json`](references/dropdown-fallbacks.json) | building any integration — static snapshot of every EMAP `/api/partner/*` dropdown response, embedded in each template's `EMAP_DROPDOWN_FALLBACKS` constant and used when the live call fails or returns no usable data. Captured from EMAP's test server; re-capture once production serves the API |
| [`references/api-quirks.md`](references/api-quirks.md) | building Integration 1 — API behaviour that differs from EMAP's own signup page (tax ID and register number exemptions, SSN country, referral and industry matching), with the reasons behind the rules in this file |
| [`verify/README.md`](verify/README.md) | after writing or editing any form file, before calling a build done — how to run [`verify_form.py`](verify/scripts/verify_form.py), what its 5 check categories cover, and what it cannot catch |

---

## Step 0: Detect the project's stack

The form works in **any stack**. The one architectural rule concerns where the EMAP requests come
from, not which framework renders the page:

> **Every EMAP call (all `POST`s, the `/api/partner/*` dropdown `GET`s, and the Integration 2
> redirect) is made by the merchant's browser, never by the partner's server.** EMAP rate-limits
> and abuse-scores signups by the caller's IP. Proxied through the partner's server, every
> merchant would share that server's IP: one abuser would get all of the partner's signups
> rate-limited, and EMAP would lose its per-merchant spam signal.
>
> The site may have any backend for everything else. Server-rendered pages are fine as long as the
> EMAP request is made by JavaScript in the page. Never call EMAP from any of these:
> - route handlers, API routes, Server Actions
> - loaders or actions
> - SSR data fetching
> - controllers, `curl` / `wp_remote_post`, serverless functions
>
> [`references/stack-guide.md`](references/stack-guide.md) lists the exact server-side APIs to avoid,
> per framework.

Detect the stack from the project's files: `package.json` dependencies, `composer.json`, `Gemfile`,
`manage.py`, `*.csproj`, SSG config, and so on. The signals are listed in the stack guide. Ask the
developer only if the signals are missing or conflicting. Then deliver the form as follows:

| Project | Deliver |
|---|---|
| React (Next.js, Vite, Remix / React Router, Gatsby, Astro + React) | `templates/integration-<n>/SignupForm.tsx`. Render it from any page. For JS-only projects, rename it `.jsx` and drop the types |
| Vue / Nuxt, Angular, Svelte / SvelteKit, Solid, other component frameworks | Mount `plain-html.html`'s markup and script in a client-only mount hook, the way `SignupForm.tsx` does (recommended), or do a native 1:1 port |
| Server-rendered (PHP / WordPress / Laravel, Rails, Django / Flask, ASP.NET, Twig / Liquid / etc.) | Embed `plain-html.html`: its CSS and script as static asset files, its `.emap-signup` markup in the page template |
| Static site / SSG | `plain-html.html` as its own page, or embedded as above |
| Hosted site builder (Webflow, Wix, Squarespace, Shopify, Framer) | A custom-code embed block, or host `plain-html.html` and iframe or link it |
| Mobile app | Load a hosted `plain-html.html` in a WebView |

Read [`references/stack-guide.md`](references/stack-guide.md) for the per-stack details: SSR pitfalls,
template-engine escaping, CSP, iframes, and the porting rules for native ports.

Both templates are the same tested form. The `plain-html.html` CSS is scoped under `.emap-signup`
and its script is IIFE-wrapped and starts via `onReady()`, so it can be embedded into an existing
page without leaking styles or globals. Put every file of the generated form under one `form_dir`
that holds nothing else. `verify_form.py` scans it recursively for all frontend source types.

---

## Step 1: Install the verify gate

> **STOP. Do not write, edit, or generate a single form file until this step is done**, in a
> brand-new project or one you're continuing. Existing form code in the project does not mean the
> gate was installed. Check for `.emap/emap_gate.py` first. If it's missing, do this step, no
> matter what else is already built.
>
> The gate decides when a build is done. [`emap_gate.py`](verify/scripts/emap_gate.py) runs
> [`verify_form.py`](verify/scripts/verify_form.py) itself and records the result; it never trusts
> a status you wrote. It is plain Python 3, so it works with any agent that can run a shell
> command, in CI, and by hand. See [Verify: schema conformance](#verify-schema-conformance) for
> what the script checks.

1. **Copy three files** into the target project's `.emap/` folder, byte for byte:
   - [`verify/scripts/emap_gate.py`](verify/scripts/emap_gate.py) → `.emap/emap_gate.py`
   - [`verify/scripts/verify_form.py`](verify/scripts/verify_form.py) → `.emap/verify_form.py`
   - [`signup-steps-schema.json`](signup-steps-schema.json) → `.emap/signup-steps-schema.json`

   `.emap/` is build tooling, not part of the form, so don't deploy it. Committing it is fine (it
   lets CI run the gate). `.emap/verify-cache.json` can be gitignored.

2. **Mark the build in progress.** As soon as you start generating code for a chosen integration
   mode, write `.emap/build-state.json`:
   ```json
   { "status": "in_progress", "integration": "1", "form_dir": "merchant-signup" }
   ```
   Use `"2"` or `"3"` to match the mode being built. Set `form_dir` to the folder holding the
   generated form files, relative to the project root. That folder should hold nothing else.

3. **Optional: have your agent enforce the gate automatically.**
   - **Claude Code:** merge the `hooks` key from
     [`verify/hooks/claude-code-settings.json`](verify/hooks/claude-code-settings.json) into the
     target project's `.claude/settings.json`. Create the file if it doesn't exist. If `hooks.Stop`
     already has entries, **append** this entry and never overwrite the others. Claude Code then
     can't finish its turn until the gate passes or the build is marked `blocked` or `cancelled`.
   - **Other agents with a hook that runs when the agent finishes:** register
     `python3 .emap/emap_gate.py` in that agent's hook format. It exits 0 when there is nothing to
     block and 1 with the findings on stdout otherwise.
   - **Agents without hooks:** nothing to install. You run the gate yourself before calling the
     build done (see [Verify: schema conformance](#verify-schema-conformance)).
   - **Any agent:** the developer can also run `python3 .emap/emap_gate.py` in CI or a pre-commit
     hook, so an unverified form can't be merged.

**Check before continuing:** confirm the three files and `.emap/build-state.json` exist on disk
(and the settings entry, if you added one). Don't assume the writes succeeded. Then continue to
[Step 2](#step-2-partner-attribution-optional) or begin generating code.

If you can't run Python 3 in this environment (for example, a browser-based app builder), tell the
developer the gate can't run here and that they must run `python3 .emap/emap_gate.py` on a machine
with Python 3 before accepting the build. Do not skip Step 1 silently.

---

## Step 2: Partner attribution (optional)

Partner attribution links the merchant signup to the partner's account in EMAP.
It is optional — signups work without it, but the partner will not get credit.

Every template uses the same constant, `EMAP_PARTNER_KEY`, set in its `<script>` block. It is an
attribution value, not a secret: it is visible in the page's JavaScript whichever integration you
build.

- **Integrations 1 and 3 (API):** the template sends it as `partner_key` in the JSON body of the
  Step 1 POST.
- **Integration 2 (redirect):** the template sends it as EMAP's `secretKey` URL parameter. Despite
  that parameter's name, the value is the same partner key, and it is also visible in the redirect
  URL.

Never commit a real key value to source control in a public repo, even though it is visible
client-side once deployed — treat "in the deployed page" and "in git history" as different
exposure surfaces.

If the developer does not yet have a partner key, refer them back to the instructions in
[Before you start — Required questions](#before-you-start--required-questions).
Integration works without a key; signups will simply not be attributed.

---

## Step 3: Choose integration mode

| | Integration 1 — Full form | Integration 2 — Redirect handoff | Integration 3 — Email-based signup |
|---|---|---|---|
| **How it works** | Partner hosts all 6 steps; the browser POSTs each step directly to EMAP's API | Partner hosts a single-step form (same fields as Int-1 Step 1); on submit, all fields are appended as URL params and browser redirects to EMAP `/signup?params` | Partner hosts a single-step form; the browser POSTs step-1 fields directly to EMAP's REST API; EMAP emails the merchant a secure link to complete their application |
| **Where merchant continues** | Partner's site — all 6 steps | EMAP, from step 2 onward (immediately after redirect) | EMAP, from step 2 onward (after clicking email link) |
| **Server code needed?** | No. The browser calls EMAP directly | No. The redirect is a browser navigation | No. The browser calls EMAP directly |
| **Auto-submit on EMAP?** | N/A — merchant never visits EMAP | When `first_name`, `last_name`, `company_name`, `phone` and `email` are all present and EMAP's page accepts the prefilled data; otherwise the merchant submits EMAP's prefilled form | N/A — the browser already submitted Step 1 |
| **Best for** | Full branding control across all 6 steps, enterprise integrations | Simple embed, static sites, fastest integration | Clean partner-side UX for step 1; merchant completes the rest on EMAP after clicking their email link |

The developer already chose the mode in Question 1. Don't ask again; use this table only to answer
their questions about the differences.

---

## Build Integration 1: Full form

**Before writing any file below:** check that `.emap/emap_gate.py` exists in this
project. If it doesn't — even if `merchant-signup/` or other build output already exists here —
go do [Step 1](#step-1-install-the-verify-gate) first.

Read [`references/mode-1-fullform.md`](references/mode-1-fullform.md) before proceeding.

> **Build strictly from `signup-steps-schema.json`.** Before writing or porting any field, look it
> up in [`signup-steps-schema.json`](signup-steps-schema.json) and follow it exactly — the widget
> `type`, the API field name/route, every validation rule (including per-country
> `countryVariants`), and every dependent/conditional field (`dependsOn`/`visibleIf`). Do not infer
> any of these from the field name, a markdown table, or prose — the JSON file is the single source
> of truth the form must be built against.

### Steps

1. **Use the template** from `templates/integration-1/`:
   - `plain-html.html`: the complete 6-step form with no build step. It is the canonical reference.
     Use it as-is, or embed it into the project's pages (see
     [Step 0](#step-0-detect-the-projects-stack)).
   - `SignupForm.tsx`: the identical form as a React component, for any React framework.
   - For any other component framework, mount the reference or **port `plain-html.html` 1:1**
     rather than regenerating the form from the prose reference alone. A port keeps:
     - the same field list
     - the same widget type per field
     - the same validation
     - the same conditional logic
     - the same browser-side `fetch()` calls to EMAP

     Use `signup-steps-schema.json` as the field-by-field spec and follow the porting rules in
     [`references/stack-guide.md`](references/stack-guide.md).
   - Whatever the stack, the EMAP calls stay in browser code. Never add a server route, action,
     or controller that calls EMAP.

2. **Set the two constants at the top of the file's `<script>` block** (search for "EDIT THESE";
   in `SignupForm.tsx` they are at the top of the `FORM_LOGIC` string):
   ```js
   var EMAP_BASE_URL = 'https://emap.epd.dev'; // EMAP's TEST server
   var EMAP_PARTNER_KEY = ''; // optional — see Step 2 above
   ```
   There is no environment variable, no `.env` file, and no server process to configure — this is
   the only configuration step. `https://emap.epd.dev` is EMAP's **test server**: build and test
   against it, and switch to the production URL Easy Pay Direct gives you before launch.

3. **Dropdowns are fetched directly from EMAP** (`GET {EMAP_BASE_URL}/api/partner/countries`, etc.)
   by the `fetchDropdownData()` function already in the template — there is no proxy route to
   implement. It already falls back to the embedded `EMAP_DROPDOWN_FALLBACKS` constant (sourced
   from [`references/dropdown-fallbacks.json`](references/dropdown-fallbacks.json)) when the live
   call errors, times out, or returns an empty/missing `data` array, so a dropdown never silently
   renders with zero options. If porting to a different stack, port `fetchDropdownData()` and the
   embedded fallback data along with the rest of the file.

4. **Understand the step flow:**
   - **Every step's request carries `step_count`** (1–6) in its JSON body, including Step 1 and Step 4.
   - Step 1 (`POST /api/v1/signup`, `step_count: 1`) returns a `uuid`. Collect: first name, last name, email, phone, company name, website, country, annual sales, **industry type**, and (if US) business state. Store the `uuid` in `localStorage('emap_uuid')`.
   - **Step 1 auto-save:** once first name, last name, email and phone are filled in, leaving one of them POSTs them to `/api/v1/signup/auto-save` in the background (EMAP creates the user and HubSpot contact, like its own signup page). No error is ever shown; Step 1's submit waits for a running auto-save. See [`references/mode-1-fullform.md`](references/mode-1-fullform.md#step-1-auto-save--post-apiv1signupauto-save).
   - Steps 2, 3, 5, 6 call `POST /api/v1/application/step` with the `uuid` and the appropriate `step_count`.
   - Step 4 calls `POST /api/v1/ownership` with `step_count: 4` and the dot-notation owner fields.
   - Step 6 success → clear `localStorage` and redirect the top-level window to EMAP's
     `{EMAP_BASE_URL}/upload-document/{uuid}?redirect=1` page, where the merchant uploads their
     documents.

5. **Pre-fill Step 2 from Step 1 data:**
   When Step 1 succeeds and the form advances to Step 2, automatically populate:
   - `legal_name` ← value of `company_name` from Step 1
   - `name` (DBA / "doing business as") ← value of `company_name` from Step 1
   The merchant can edit these fields in Step 2 if the legal name differs from the trading name.
   Only pre-fill when the fields are currently empty (do not overwrite if the merchant has already typed something or if the session was restored from localStorage).
   Also, like EMAP's own form, pre-fill Owner 1's mobile phone (`phone.1`, Step 4) with the Step 1
   `phone` when "Are you the primary contact?" is Yes. Switching to No clears it if it still holds
   the Step 1 number; switching back to Yes restores it.

   **Phone fields** (`phone`, `customer_service_telephone_number`, `phone.1`, `phone.2`) use
   intl-tel-input 22.0.2, the version EMAP's own signup page uses: a country picker (US first,
   then CA), as-you-type formatting such as `(202) 555-1234`, and its example number as the
   placeholder. Block submit unless `isValidNumber()` is true, and send `getNumber()`, which is
   E.164 (`+12025551234`). Load `utils.js` with its own SRI-pinned `<script>` tag and hand it over
   with `window.intlTelInput.utils = window.intlTelInputUtils`. The library's `utilsScript` option
   injects the script without an integrity hash.

6. **Back-navigation between steps:**
   The numbered steps in the progress bar are clickable for steps already reached in this page
   session (not after a reload, when earlier answers are gone). Style every `:disabled` input, select,
   textarea, radio and checkbox visibly (grey background, muted text, `not-allowed` cursor) so
   read-only fields are obvious.
   Render a Back button on steps 2–6. Going back keeps what the merchant typed, and they can edit
   and re-submit that step: the API accepts a step again with the same `uuid`.
   - **Step 1 is read-only** when returned to. `POST /api/v1/signup` can't be replayed (the email
     is now registered), so disable its inputs and have Continue go to step 2 without calling the API.
   - **Step 4: owner identity is read-only** once saved, as in EMAP's single-page signup. Disable
     "Are you the business owner?", each owner's first name, last name and email, and each
     ownership percentage; everything else on step 4 (job title, phone, DOB, SSN, address, ID) stays
     editable. Disabled inputs are left out of `FormData`, so read the **locked fields'** values back
     by id when building the re-submit payload. Never copy back every disabled control: the hidden
     half of each State text box / US-state dropdown pair is also disabled and has the same `name`,
     so copying it overwrites the chosen state with an empty value (EMAP answers "State is
     required"). Steps 2, 3, 5 and 6 have nothing locked.
   - Each re-submit sends that step's own `step_count`. Never skip a re-submit to jump ahead.
   - After a page reload the earlier answers are gone, so hide Back on the restored step.
   - No Back on the upload-document page: step 6 success redirects to EMAP.

7. **Handle conditional fields:**
   > Read `visibleIf` (shown) and `dependsOn` (required) separately for every conditional field;
   > they are different expressions. Where EMAP's API and its own signup page disagree, follow the
   > API. The rules below already do; [`references/api-quirks.md`](references/api-quirks.md) has
   > the evidence for each.
   - `industry_type` is collected in **Step 1** (not Step 2) and submitted with `POST /api/v1/signup`. Show `industry_type_other` when `industry_type = other`, matched **case-insensitively** — the live `/api/partner/industry-types` endpoint's catch-all slug is `Other` (capitalized), not `other` (step 1).
   - `country=US` → show `business_state` (step 1) and `state.1` (step 4).
   - `emap_country` (Step 1) = `CA` **or** `business_organized` = `Sole-Proprietorship` → hide/disable & un-require `federal_tax_id` (step 2). Otherwise it's shown, required, and masked per `countryVariants` (see point 9). Re-evaluate whenever either field changes.
   - `emap_country` (Step 1) = `US` → hide/un-require `business_register_number` (step 2). This is the ONLY exemption the API grants — do not also exempt Puerto Rico or CA+Sole-Proprietorship.
   - `is_physical_address_same_as_legal_address=0` → show the physical address block (step 2).
   - `marketingModel` includes `2` → show `subscription_frequency`; if frequency=`3` show `subscription_frequency_other` (step 2).
   - `fulfillment_by` is `Vendor` or `Others` → show `fullfillment_company` (double-l, step 3).
   - `primary_contact=0` → show `first_name.1`, `last_name.1`, `email.1`, `primary_contact_job_title` (step 4).
   - `ownership_percentage.1 < 51` → show Owner 2 section (step 4).
   - `country.1=US` → show `driver_license_state.1` and `driver_license_expiration_date.1` (step 4).
   - `emap_country` (Step 1) = `CA` → show `institution_number` + `customer_pay_currency` (step 5).
   - `bad_experience=true` → show `bad_experience_happened` (step 6).
   - `howdidyouhear` is "Other", "Friend", or "Live Event / Trade Show" → show `hear_about_us_other`
     (step 6). Match on the slug or name text (`Other`, `Friend`, `Live-Event-/-Trade-Show`); the
     endpoint returns no id.

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
     equivalent" for non-US/CA/PR. See the field's `countryVariants` in `signup-steps-schema.json`.
   - `institution_number` — see its `countryVariants`/`pattern` in the schema.

10. **Card percentage (step 3):** `card_swiped + customer_entered + staff_entered` must equal 100.
    Validate client-side and block submission if not.

11. **SSN/SIN (step 4):** For US/CA/PR, apply Cleave.js mask `blocks:[3,2,4] delimiters:["-","-"]`
    to format as `XXX-XX-XXXX`, labelled "SSN/SIN". Validate: `ssn.replace(/-/g,'').length >= 9`.
    For every other country, show a plain, unmasked text field labelled "SSN (or personal Tax ID
    equivalent)" with no format check beyond required.
    > The country that drives this is `country_from_step1`, the single Step 1 formation country,
    > for **both** `ssn.1` and `ssn.2`. It is not each owner's own `country.1` / `country.2`, which
    > only gate the driver-licence fields.
    - Owner 1's SSN (`ssn.1`) is always required. Owner 2's SSN (`ssn.2`) is required only when
      the Owner 2 section is shown (`ownership_percentage.1 < 51`).

12. **DOB (step 4):** Owner must be between 18 and 100 years old.
    `maxDate = today − 18 years`, `minDate = today − 100 years`.
    Enforce this client-side (the calendar picker's `min`/`max` attributes plus a submit-time
    check). EMAP's API doesn't check it, so the form's check is the only one; see
    [`references/api-quirks.md`](references/api-quirks.md).
    - **Every date field shows `YYYY-MM-DD`** (`business_formed`, `dob.*`,
      `driver_license_expiration_date.*`, `bankruptcy_discharged_date.*`). Don't render a bare
      `<input type="date">`: browsers display it in the visitor's locale format (e.g.
      `MM/DD/YYYY` in the US). The template uses a text box masked with Cleave.js
      (`date: true, datePattern: ['Y','m','d'], delimiter: '-'`) plus a transparent, unnamed
      native date input over a calendar icon; a picked date is copied into the text box. Each
      step's submit rejects a typed value that isn't a real `YYYY-MM-DD` date.

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
    **This does not replace a live test.** The script catches a mismatch between the schema and
    the code, not both being wrong about the API (see "What this script cannot catch" in
    [`verify/README.md`](verify/README.md)). Once it passes, submit one 6-step signup for a
    representative edge case (e.g. a non-CA Sole-Proprietorship) against EMAP's **test server**,
    with an email address you control. Never create test applications on EMAP's production server.
    - **Run the [Verify: schema conformance](#verify-schema-conformance) step**, then
      [Verify: security and coverage](#verify-security-and-coverage), before telling the developer
      the form is done. The build is not done until `python3 .emap/emap_gate.py` prints `PASS`.


---

## Build Integration 2: Redirect handoff

**Before writing any file below:** check that `.emap/emap_gate.py` exists in this
project. If it doesn't — even if `merchant-signup/` or other build output already exists here —
go do [Step 1](#step-1-install-the-verify-gate) first.

Read [`references/mode-2-redirect.md`](references/mode-2-redirect.md) before proceeding.

> **Build strictly from `signup-steps-schema.json`.** Before writing any field, look it up in
> [`signup-steps-schema.json`](signup-steps-schema.json) and follow it exactly — the widget `type`,
> the API field name, every validation rule (including per-country `countryVariants`), and every
> dependent/conditional field (`dependsOn`/`visibleIf`). Do not infer any of these from the field
> name, a markdown table, or prose — the JSON file is the single source of truth the form must be
> built against.
>
> **One exception for Integration 2:** for `country` and `industry_type`, send the value named by
> the field's `integration2UrlValue` in the schema (the display **name**), not the code or slug.
> EMAP's `/signup` page matches these by name. Keep the code/slug in a `data-code` / `data-slug`
> attribute for the form's own conditional logic.

### Overview

Integration 2 is a **single-step form** — it collects exactly the same fields as Integration 1
Step 1 (basic merchant info). There is **no Terms and Conditions checkbox**. On submit, all form
fields are serialized as URL query parameters and the browser redirects to
`{EMAP_BASE_URL}/signup?{params}`. EMAP reads the params and prefills its form. When
`first_name`, `last_name`, `company_name`, `phone` and `email` are all present, EMAP's page
validates the prefilled data and, if it passes, submits it for the merchant, who lands on step 2.
Otherwise the merchant reviews EMAP's prefilled form and submits it. (Observed on EMAP's test
server; see [`references/mode-2-redirect.md`](references/mode-2-redirect.md).)

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

1. **Use the template** from `templates/integration-2/`:
   - `plain-html.html`: a client-side form that builds and follows the redirect URL. It is the
     canonical reference. Use it as-is, or embed it (see
     [Step 0](#step-0-detect-the-projects-stack)).
   - `SignupForm.tsx`: the identical form as a React component, for any React framework.
   - For any other component framework, mount the reference or port it 1:1 (see
     [`references/stack-guide.md`](references/stack-guide.md)). The redirect must be a browser
     navigation, never a server-side redirect built from the submitted data.
   - **Step 1 auto-save:** once first name, last name, email and phone are filled in, leaving one
     of them POSTs them to `/api/v1/signup/auto-save` in the background, as Integrations 1 and 3
     do. EMAP's own `/signup` page skips its auto-save for visitors arriving from the redirect,
     so this is what saves a merchant who fills in their details but never submits. No error is
     ever shown, and submit waits for a running auto-save before redirecting. See
     [`references/mode-2-redirect.md`](references/mode-2-redirect.md#step-1-auto-save).

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
   // navigateTop() navigates the top-level window (falls back to this frame), so the
   // handoff also works when the form is embedded in an iframe.
   navigateTop(EMAP_BASE_URL + '/signup?' + params.toString());
   ```

3. **Pass UTM params through.** Read `utm_campaign`, `utm_source`, `utm_medium`, `utm_term`,
   `utm_content`, and the click IDs `gclid`, `gbraid`, `wbraid`, `fbclid` from the current page URL and
   append them to the redirect URL. The templates do this automatically.

   Integrations 1 and 3 call the API instead, so their templates send the same values, plus
   `fbclid`, as extra fields on the Step 1 `POST /api/v1/signup` body. `getTracking()` reads them
   from the landing page URL and uses them as the current attribution and stores them in `localStorage` (`emap_tracking`) for
   30 days. New params on the URL replace the stored ones (the old ones are discarded); with none
   on the URL, the stored ones are reused, so a refresh or a later direct return keeps the source.
   Send them only when present; EMAP ignores absent ones.

   **Saved at Step 1 only.** EMAP stores attribution in `utm_tracking` (on the user and the
   application) as flat keys, from the Step 1 request. Steps 2 to 6 don't send it, and EMAP ignores
   these fields on those endpoints, so a merchant who changes the URL mid-signup doesn't change what
   was saved. The HubSpot deal and contact properties (`utm_*`, `gclid`, `gbraid`, `wbraid`,
   `fbclid`) carry the Step 1 values.

4. **Set the two constants at the top of the file's `<script>` block** (search for "EDIT THESE"):
   ```js
   const EMAP_BASE_URL = 'https://emap.epd.dev'; // EMAP's TEST server
   const EMAP_PARTNER_KEY = ''; // optional — see Step 2 above
   ```
   There is no environment variable, no `.env` file, and no server process to configure. Switch
   `EMAP_BASE_URL` to the production URL Easy Pay Direct gives you before launch.

5. **Know where the PII goes.** The redirect URL carries the merchant's name, email and phone in
   its query string. A `Referrer-Policy` on *your* page doesn't protect that URL: it's the EMAP page
   that loads with it, so only EMAP's own `Referrer-Policy` and handling can keep it out of the
   `Referer` header its page sends. Tell the developer this is a property of the redirect mode. If
   it's unacceptable, recommend Integration 3, which sends the data in a POST body.

6. **Test against EMAP's test server:**
   - Missing auto-submit fields: leave `phone` empty. EMAP shows its form prefilled and the
     merchant submits it.
   - Full prefill: fill every field with valid data. EMAP submits for the merchant, who lands on
     step 2. If EMAP's page rejects a value (for example an unrecognised website), the merchant
     sees EMAP's prefilled form instead. See
     [`references/mode-2-redirect.md`](references/mode-2-redirect.md).
   - **Run the gate, `python3 .emap/emap_gate.py`** (see
     [Verify: schema conformance](#verify-schema-conformance)), then
     [Verify: security and coverage](#verify-security-and-coverage), before telling the developer
     the form is done. The manual testing above does not substitute for either. The build is not
     done until the gate prints `PASS`.


---

## Build Integration 3: Email-based signup

**Before writing any file below:** check that `.emap/emap_gate.py` exists in this
project. If it doesn't — even if `merchant-signup/` or other build output already exists here —
go do [Step 1](#step-1-install-the-verify-gate) first.

Read [`references/mode-3-api.md`](references/mode-3-api.md) before proceeding.

> **Build strictly from `signup-steps-schema.json`.** Before writing any field, look it up in
> [`signup-steps-schema.json`](signup-steps-schema.json) and follow it exactly — the widget `type`,
> the API field name, every validation rule (including per-country `countryVariants`), and every
> dependent/conditional field (`dependsOn`/`visibleIf`). Do not infer any of these from the field
> name, a markdown table, or prose — the JSON file is the single source of truth the form must be
> built against.

### Steps

1. **Use the template** from `templates/integration-3/`:
   - `plain-html.html`: the client-side form with no build step. It is the canonical reference.
     Use it as-is, or embed it (see [Step 0](#step-0-detect-the-projects-stack)).
   - `SignupForm.tsx`: the identical form as a React component, for any React framework.
   - For any other component framework, mount the reference or port it 1:1 (see
     [`references/stack-guide.md`](references/stack-guide.md)).
   The form POSTs directly from the browser to `{EMAP_BASE_URL}/api/v1/signup` with `partner_key`
   (if set) and `trigger_email: true` in the JSON body — this flag tells EMAP to dispatch the
   welcome/verification email as part of this same call; without it, the account is created but no
   email is sent. Note: the API field for company name is `name`, not `company_name` — the
   template already remaps this at submit time (see its comments); it is a UI-only field name
   chosen for label clarity. Before that, once name, email and phone are filled in, the form
   auto-saves them to `/api/v1/signup/auto-save` in the background, exactly as Integration 1's
   Step 1 does (see [`references/mode-3-api.md`](references/mode-3-api.md#auto-save)).

2. **Set the two constants at the top of the file's `<script>` block** (search for "EDIT THESE"):
   ```js
   const EMAP_BASE_URL = 'https://emap.epd.dev'; // EMAP's TEST server
   const EMAP_PARTNER_KEY = ''; // optional — see Step 2 above
   ```
   There is no environment variable, no `.env` file, and no server process to configure. Switch
   `EMAP_BASE_URL` to the production URL Easy Pay Direct gives you before launch.

3. **Handle all response shapes** on the client side (see
   [`references/api-errors.md`](references/api-errors.md) for the full table). The form is used by
   the merchant, so every message speaks to them:
   - `{"status":true,"uuid":"..."}` → show "Check Your Email" with the address the link went to.
     **Never display, log or store the `uuid`**: anyone holding it can continue that application.
   - `{"verificationLink":true,"url":"..."}` (existing user) → show the same "Check Your Email"
     panel with a note that the email is already registered. Don't navigate to `url`.
   - `{"status":false,"message":"Company already exists"}` → tell the merchant an application
     already exists and to check their inbox or contact Easy Pay Direct.
   - HTTP 422 → display per-field errors from `response.errors`.
   - HTTP 429 → tell merchant to wait and retry.

4. **Test against EMAP's test server** by submitting with a unique email address you control.
   Check that "Check Your Email" appears and the email arrives. Never test on production.
   - **Run the gate, `python3 .emap/emap_gate.py`** (see
     [Verify: schema conformance](#verify-schema-conformance)), then
     [Verify: security and coverage](#verify-security-and-coverage), before telling the developer
     the form is done. The manual testing above does not substitute for either. The build is not
     done until the gate prints `PASS`.


---

## Verify: schema conformance

Run the gate from the project root. It runs [`verify_form.py`](verify/scripts/verify_form.py), a
deterministic script with no LLM reading involved, against the tracked form:

```
python3 .emap/emap_gate.py
```

Don't spot-check fields by hand against `signup-steps-schema.json` instead. The build is done only
when the gate prints `PASS`, whatever agent you are. [`verify/README.md`](verify/README.md) covers
the loop (fix → scoped re-run → gate again, capped at 5 failing gate runs), what each of the 5 check
categories covers, and what the script structurally cannot catch: some bugs need a live test on
EMAP's test server, not just a schema-vs-code diff.

---

## Verify: security and coverage

Before going live, run through [`references/security-checklist.md`](references/security-checklist.md).

Quick self-check — **[Verify: schema conformance](#verify-schema-conformance) above checks schema
conformance only; it does not check deployment/config wiring, so these items need a manual look,
not just a clean `verify_form.py` run**:
- [ ] HTTPS on your site.
- [ ] `EMAP_BASE_URL` points at the production URL Easy Pay Direct gave you, not the test server
  `https://emap.epd.dev`.
- [ ] `EMAP_PARTNER_KEY` set directly in the deployed file, not left as the placeholder `''` unless
  attribution is intentionally being skipped. Confirmed with the developer that they accept it
  being visible client-side (see Step 2 above) — do not silently decide this for them.
- [ ] Integration 3: the success panel doesn't show the application `uuid`, and no form stores it
  anywhere except Integration 1's own `localStorage` resume key.
- [ ] Submit button disabled on first click (double-submit prevention).
- [ ] Generic user-facing errors — do not expose EMAP's raw error messages verbatim to the merchant.
- [ ] **The embedded dropdown-fallback data is actually present in the deployed file**, not
  stripped out by a build step — confirm `EMAP_DROPDOWN_FALLBACKS` (or the template's equivalent
  constant) still exists in what's actually deployed, and that the fallback path is genuinely
  reachable (e.g. by testing with `EMAP_BASE_URL` pointed at an unreachable host briefly), not
  merely defined and never invoked.
- [ ] **No server-side code calls EMAP.** Check for route handlers, API routes, Server Actions,
  loaders and actions, SSR data fetching, controllers, `curl` / `wp_remote_post`, and serverless
  functions ([`references/stack-guide.md`](references/stack-guide.md) lists them per framework).
  If one exists, the integration was built wrong. Every EMAP request must come from the merchant's
  browser so EMAP's IP-based rate limiting sees the merchant's IP.

---

## Guardrails

**Any stack is fine, but every EMAP call is made by the merchant's browser, by design.** Never
route EMAP requests through the partner's server in any form:
- an API route, Server Action, loader or action
- SSR data fetching
- a controller, `curl` / `wp_remote_post`, or a serverless function

EMAP rate-limits signups by the caller's IP, and a server proxy would put every merchant behind
one IP. EMAP's API allows browser calls via CORS. The partner key constant is therefore visible in
the deployed page's source. That is an accepted, developer-confirmed tradeoff (see Step 2 above),
not an oversight to "fix" by adding a backend proxy.
**Still never print or log the partner key to any third-party analytics/error tool, and never
commit a real key value to a public source repo** — "visible in the deployed page" and "visible in
git history/log aggregators" are different exposure surfaces, and only the first is accepted here.
**Never store PII (name, email, phone) anywhere yourself — EMAP is the system of record and there
is no backend of this form's own to store it in.**
**Never add document upload fields — EMAP collects documents in its own UI after step 6.**
**Do not modify field validation rules — EMAP will reject submissions that don't pass its own
server-side rules regardless of what this form allows through.**
