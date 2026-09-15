# EMAP Merchant Signup Integration

A drop-in integration kit for embedding Easy Pay Direct (EMAP) merchant onboarding into your website or application. Merchants submit their business details through your interface; EMAP handles underwriting, e-signature, and account provisioning.

---

## Integration modes

| Mode | Description | Backend required |
|---|---|---|
| **1 — Full Form** | You host all 6 signup steps; your server proxies each submission to the EMAP API. Merchants never leave your domain. | Yes |
| **2 — Redirect Handoff** | You collect step-1 fields; on submit the browser redirects to EMAP's `/signup` with data pre-filled as URL parameters. | No |
| **3 — Email Signup** | You collect step-1 fields; your server POSTs to the EMAP API and EMAP emails the merchant a secure link to complete their application. | Yes |

---

## Quickstart

### 1. Get your credentials

Contact Easy Pay Direct to receive:
- Your `EMAP_BASE_URL` (production or staging)
- Your `EMAP_PARTNER_KEY` (backend only — never expose to browsers)

### 2. Pick a template

```
templates/
  integration-1/
    plain-html.html     — 6-step form (copy and style)
    php-vanilla.php     — PHP backend: serves form + proxies all 6 steps
    node-express.js     — Express.js backend
    nextjs-route.ts     — Next.js App Router route handlers
  integration-2/
    plain-html.html     — Standalone HTML, no backend needed
    php-vanilla.php     — PHP: renders form + builds redirect server-side
    node-express.js     — Express.js variant
    nextjs-route.ts     — Next.js variant
  integration-3/
    plain-html.html     — Single-step HTML form
    php-vanilla.php     — PHP backend: form + EMAP API proxy in one file
    node-express.js     — Express.js backend
    nextjs-route.ts     — Next.js API route (TypeScript)
```

### 3. Set environment variables

```bash
EMAP_BASE_URL=https://emap.epd.dev       # provided by Easy Pay Direct
EMAP_PARTNER_KEY=your_key_here           # backend only, never in browser code
```

### 4. Drop the template into your project

Each template is self-contained. Copy the file(s) into your project, set the environment variables, and the integration is live.

---

## Choosing a mode

**Integration 1** — Full control. The merchant stays on your domain for all 6 steps. Requires a backend to proxy each step to EMAP. Best for partners who want full branding ownership and access to all application data as it's collected.

**Integration 2** — Zero backend. A static HTML form sends the merchant to EMAP's hosted signup page with their details pre-filled. Suitable for Webflow, WordPress, or any environment with no server-side code. Step-1 PII will appear briefly in the redirect URL.

**Integration 3** — Clean handoff. Your form POSTs to your server, which calls the EMAP API and returns a UUID. EMAP emails the merchant a secure link to complete their application from step 2 onward. Good middle ground: you control the first impression, EMAP handles the rest.

---

## API overview

All backend modes proxy to these EMAP endpoints:

| Step | EMAP endpoint | Key fields |
|---|---|---|
| 1 — Business basics | `POST /api/v1/signup` | `first_name`, `last_name`, `email`, `phone`, `name`, `website`, `country`, `annual_sales` |
| 2 — Company info | `POST /api/v1/application/step` | `step_count=2`, `uuid`, legal address, EIN, revenue model |
| 3 — Products | `POST /api/v1/application/step` | `step_count=3`, processing percentages, fulfillment, refund policy |
| 4 — Ownership | `POST /api/v1/ownership` | `uuid`, owner SSN/SIN, DOB, ownership percentage |
| 5 — Banking | `POST /api/v1/application/step` | `step_count=5`, `uuid`, routing/account numbers |
| 6 — Final details | `POST /api/v1/application/step` | `step_count=6`, `uuid`, referral source, T&C acceptance |

Step-1 success returns `{ "status": true, "uuid": "..." }`. Store the `uuid` in session — every subsequent step requires it.

### Dropdown data endpoints

Populate selects from these EMAP GET endpoints (results are cacheable):

| Data | Endpoint |
|---|---|
| Countries | `GET /api/partner/countries` |
| US states | `GET /api/partner/states` |
| Industry types | `GET /api/partner/industry-types` |
| Shopping carts | `GET /api/partner/shopping-carts` |
| Referral sources | `GET /api/partner/referral-sources` |
| Interest details | `GET /api/partner/interest-details` |

Country options return ISO 3166-1 alpha-2 codes as values (`US`, `CA`, `GB`, `AU`). Industry-type values are slugs (e.g. `Retail(eCommerce)-Other`) — use the API value as-is for submission.

---

## Country-dependent field labels

Three fields on Steps 4 and 5 change label and hint text based on the country selected in Step 1:

| Field | US / CA | AU | GB | Other |
|---|---|---|---|---|
| SSN field | SSN / SIN | Personal Tax ID | Personal Tax ID | Personal Tax ID / Gov ID |
| Routing number | Routing Number / Transit Number | BSB Code | Sort Code | BIC / SWIFT / Routing Number |
| Account number | Account Number | Account Number | Account Number | IBAN / Account Number |

The `plain-html.html` templates handle this automatically via a `updateCountryLabels(country)` function called on country change and on step navigation.

---

## Security checklist

- Store `EMAP_PARTNER_KEY` server-side only. It must never appear in browser-rendered HTML or JavaScript.
- Integration 1 and 3 backends validate CSRF tokens on every POST (PHP template uses `$_SESSION['csrf_token']`).
- All curl calls to EMAP enforce `CURLOPT_SSL_VERIFYPEER = true` and `CURLOPT_SSL_VERIFYHOST = 2`.
- Honeypot field (`_hp`) silently discards bot submissions without revealing the check.
- Integration 2 sends PII in URL parameters — acceptable for low-risk flows, but consider Integration 3 if you need to keep data off the URL.
- Never log full request bodies — they contain SSNs and routing numbers.

---

## Field reference

See [`references/field-catalog.md`](references/field-catalog.md) for the complete field list, types, validation rules, and which steps each field belongs to.

For integration-specific deep dives:
- [`references/mode-1-fullform.md`](references/mode-1-fullform.md) — all 6 steps, conditional logic, session handling
- [`references/mode-2-redirect.md`](references/mode-2-redirect.md) — URL parameter encoding, auto-submit behavior
- [`references/mode-3-api.md`](references/mode-3-api.md) — API call shape, success/error handling, resend link
- [`references/api-errors.md`](references/api-errors.md) — error shapes, status codes, retry guidance
- [`references/security-checklist.md`](references/security-checklist.md) — pre-launch checklist

---

## Testing locally

A self-contained test harness is included in `skill-test/` (sibling directory):

```bash
# Requires PHP 7.4+ with curl extension and a local EMAP instance on port 8000
php -S 127.0.0.1:3002 -t skill-test/ skill-test/router.php
```

Then open `http://127.0.0.1:3002` in your browser and select a mode to test.

The harness routes:
- `GET /api/*` → EMAP dropdown proxy
- `POST /api/step/N` → EMAP step endpoint (no CSRF required in test mode)
- `/int1.php`, `/int2.php`, `/int3.php` → individual integration wrappers

Set `EMAP_BASE_URL` in `router.php` to point to your local EMAP instance.

---

## Support

Contact Easy Pay Direct for partner credentials, staging access, or integration questions:
- Email: newclients@easypaydirect.com
- Phone: +1 (800) 805-4949
