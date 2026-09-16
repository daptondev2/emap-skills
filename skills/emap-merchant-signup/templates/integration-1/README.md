# Integration 1 Templates

## Templates

### `plain-html.html`
A complete standalone HTML page hosting all 6 EMAP signup steps on the partner's site.
The merchant never leaves the partner's domain. Each step POSTs to the partner backend,
which proxies the request to EMAP's API and returns the result.

**Use when:** you want full control of the merchant experience across all 6 steps —
branding, styling, copy, and error messages — and you have a backend server to proxy
the EMAP API calls.

**Setup:** No configuration needed in the HTML file itself. The form calls `/api/step/{n}`
on your backend, which injects the partner key.

### `node-express.js`
An Express.js backend that proxies all 6 signup steps to EMAP's API. The partner key
is read from the environment and never exposed to the browser.

### `nextjs-route.ts`
Next.js App Router route handlers for all 6 steps and all 6 dropdown endpoints.
The file contains one export per route with a comment showing the target file path
(`app/api/step/1/route.ts`, etc.). Copy each section into its own file and rename
the export to `GET` or `POST`.

**Dependencies:** `next`, `typescript`

**Setup:** Add to `.env.local`:
```
EMAP_BASE_URL=https://emap.epd.dev
EMAP_PARTNER_KEY=your_partner_key_here
```

### `php-vanilla.php`
A single PHP file that serves the form (GET) and proxies all 6 steps (POST) to EMAP.
Steps are identified by the `_step` field in the request body. Dropdown data is proxied
via `GET ?_dropdown=countries`, `?_dropdown=states`, etc.

CSRF protection is enabled via PHP sessions. The CSRF token is injected into
`plain-html.html` by replacing the `<!-- PHP_CSRF_TOKEN -->` placeholder.

**Requirements:** PHP 7.4+, `curl` extension enabled.

**Setup:** Set in your server environment or `.env` loader:
```
EMAP_BASE_URL=https://emap.epd.dev
EMAP_PARTNER_KEY=your_partner_key_here
```

**Important:** Update the form's fetch calls in `plain-html.html` to POST to the PHP
file URL and include `_step` and `_csrf` fields. Add `<!-- PHP_CSRF_TOKEN -->` inside
the `<body>` tag so the PHP file can inject the token.

**Dependencies:**
```bash
npm install express dotenv node-fetch@2
```

**Setup:** Create `.env` (never commit it):
```
EMAP_BASE_URL=https://emap.epd.dev
EMAP_PARTNER_KEY=your_partner_key_here
PORT=3000
```

**Run:**
```bash
node node-express.js
```

---

## How it works

1. Merchant fills in Step 1 (basic business info). Your backend POSTs to `EMAP /api/v1/signup`.
   EMAP returns a `uuid` that identifies the in-progress application.
2. The `uuid` is stored in `localStorage` and sent with every subsequent step.
3. Steps 2, 3, 5, and 6 POST to `EMAP /api/v1/application/step` with the appropriate `step_count`.
4. Step 4 (ownership) POSTs to `EMAP /api/v1/ownership`.
5. On Step 6 success, EMAP finalises the application and notifies your backend.

---

## Backend routes

| Your route | EMAP endpoint | Notes |
|---|---|---|
| `GET /api/countries` | `GET /api/partner/countries` | Cached 1 h |
| `GET /api/states` | `GET /api/partner/states` | Cached 1 h |
| `GET /api/industry-types` | `GET /api/partner/industry-types` | Cached 1 h |
| `GET /api/shopping-carts` | `GET /api/partner/shopping-carts` | Cached 1 h |
| `GET /api/referral-sources` | `GET /api/partner/referral-sources` | Cached 1 h |
| `GET /api/interest-details` | `GET /api/partner/interest-details` | Cached 1 h |
| `POST /api/step/1` | `POST /api/v1/signup` | Injects `partner_key` from env |
| `POST /api/step/2` | `POST /api/v1/application/step` (`step_count=2`) | Requires `uuid` |
| `POST /api/step/3` | `POST /api/v1/application/step` (`step_count=3`) | Requires `uuid` |
| `POST /api/step/4` | `POST /api/v1/ownership` | Requires `uuid` |
| `POST /api/step/5` | `POST /api/v1/application/step` (`step_count=5`) | Requires `uuid` |
| `POST /api/step/6` | `POST /api/v1/application/step` (`step_count=6`) | Requires `uuid` |

---

## Customisation

1. **Styling:** Replace the inline CSS with your own design system. The template uses
   minimal styles only — no framework dependencies.
2. **Step copy:** Each step has a `<h2>` and optional `<p class="step-desc">`. Edit these freely.
3. **Conditional fields:** Do not remove or rename conditional field triggers
   (e.g. `country`, `business_organized`, `is_physical_address_same_as_legal_address`, `ownership_percentage.1`).
   EMAP's validation depends on the correct field names and values.
4. **Owner 2:** Owner 2 fields appear automatically when Owner 1's ownership percentage < 51%.
   You can add Owner 3+ using the same dot-notation pattern (`first_name.3`, `ssn.3`, etc.).
5. **Interest details:** Loaded from `/api/interest-details` as grouped checkboxes. The groups
   and slugs are defined by EMAP.

---

## Local storage

| Key | Value | When set | Cleared |
|---|---|---|---|
| `emap_uuid` | Application UUID from Step 1 response | After Step 1 succeeds | Step 6 success |
| `emap_country` | 2-char country code (e.g. `US`, `CA`) | After Step 1 succeeds | Step 6 success |

`localStorage` is used (not `sessionStorage`) so the UUID and country survive accidental
tab closes and browser restarts. When the merchant reopens the page, the stored UUID is
read back and they can continue from where they left off without repeating Step 1.

Both keys are cleared on Step 6 success (application complete).

---

## Testing

1. Set `EMAP_BASE_URL` to the EMAP staging URL from Easy Pay Direct.
2. Set `EMAP_PARTNER_KEY` (optional; signups work without it but won't be attributed).
3. Run `node node-express.js` and open `http://localhost:3000`.
4. Complete all 6 steps with test data. Verify Step 6 shows the success panel.
5. Test the card percentage validator: set card_swiped + customer_entered + staff_entered ≠ 100.
   The form should block submission.
6. Test country → state conditional: select `US`, verify the state dropdown appears.
   Select a non-US country, verify it hides.
7. Test Owner 2: set ownership_percentage.1 < 51, verify Owner 2 section appears.
8. Test SSN mask (US/CA): verify Cleave.js formats input as `XXX-XX-XXXX`.
