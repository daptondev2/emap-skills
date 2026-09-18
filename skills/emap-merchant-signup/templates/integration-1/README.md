# Integration 1 Templates

Works in any tech stack. No server-side code is involved: every step calls EMAP's API directly
from the merchant's browser.
Keep it that way. EMAP rate-limits signups by the caller's IP, so the requests must come from
the merchant's browser, not from a server proxy.

## Templates

### `plain-html.html`
A complete standalone HTML page hosting all 6 EMAP signup steps on the partner's site.
The merchant never leaves the partner's domain. Each step POSTs directly to EMAP's API
from the browser via `fetch()`.

**Use when:** you want full control of the merchant experience across all 6 steps —
branding, styling, copy, and error messages — in any stack.

**Setup:** Open the file and set the constants near the top of the `<script>` block:
```javascript
var EMAP_BASE_URL = 'https://emap.epd.dev'; // EMAP's TEST server; switch to production at launch
var EMAP_PARTNER_KEY = 'your_partner_key_here'; // optional; leave '' if unused
```
No build step, server, or environment variables are required. Before launch, set
`EMAP_BASE_URL` to the production URL Easy Pay Direct gives you.

### `SignupForm.tsx`
A **React component** wrapping the exact same tested markup, styles, and logic as
`plain-html.html`. It makes no server-side calls: the component calls EMAP's API directly from
the browser, same as the plain HTML version.

**Use when:** the site is built with React. That covers Next.js (App or Pages Router), Vite,
Remix / React Router, Gatsby, and Astro (`client:only="react"`). For a JavaScript project,
rename it to `.jsx` and delete the type annotations. It is safe under StrictMode and repeated
mount/unmount, and its CSS is scoped under `.emap-signup`.

**Setup:** Import and render `<SignupForm />` anywhere in your app. Set the same
`EMAP_BASE_URL` / `EMAP_PARTNER_KEY` constants inside the component's embedded script.

### Any other stack
Vue / Nuxt, Angular, Svelte, PHP / WordPress, Rails, Django, ASP.NET, static site generators,
site builders, and mobile WebViews all work. `plain-html.html` is built to be embedded: its CSS
is scoped under `.emap-signup`, and its script is IIFE-wrapped and starts via `onReady()`, so it
runs correctly even when injected after page load. See
[`../../references/stack-guide.md`](../../references/stack-guide.md) for how to deliver it in each
stack, and for the porting rules if you rewrite it natively.

---

## How it works

1. Merchant fills in Step 1 (basic business info). The browser POSTs directly to
   `EMAP /api/v1/signup`. EMAP returns a `uuid` that identifies the in-progress application.
2. The `uuid` is stored in `localStorage` and sent with every subsequent step.
3. Steps 2, 3, 5, and 6 POST to `EMAP /api/v1/application/step` with the appropriate `step_count`.
4. Step 4 (ownership) POSTs to `EMAP /api/v1/ownership`.
5. On Step 6 success, the browser redirects the merchant to
   `{EMAP_BASE_URL}/upload-document/{uuid}?redirect=1` to continue on EMAP.

EMAP's API allows these cross-origin browser calls via CORS, so no proxy is needed. If EMAP limits
that to registered partner sites, register your site's origin with Easy Pay Direct.

---

## API calls made directly from the browser

| Called from the browser | EMAP endpoint | Notes |
|---|---|---|
| Dropdown load | `GET /api/partner/countries` | Falls back to the embedded `EMAP_DROPDOWN_FALLBACKS` data if the live call fails, times out or returns no usable rows |
| Dropdown load | `GET /api/partner/states` | Same fallback behavior |
| Dropdown load | `GET /api/partner/industry-types` | Same fallback behavior |
| Dropdown load | `GET /api/partner/shopping-carts` | Same fallback behavior |
| Dropdown load | `GET /api/partner/referral-sources` | Same fallback behavior |
| Dropdown load | `GET /api/partner/interest-details` | Same fallback behavior |
| Step 1 submit | `POST /api/v1/signup` | Sends `partner_key` from the `EMAP_PARTNER_KEY` constant, if set |
| Step 2 submit | `POST /api/v1/application/step` (`step_count=2`) | Requires `uuid` |
| Step 3 submit | `POST /api/v1/application/step` (`step_count=3`) | Requires `uuid` |
| Step 4 submit | `POST /api/v1/ownership` | Requires `uuid` |
| Step 5 submit | `POST /api/v1/application/step` (`step_count=5`) | Requires `uuid` |
| Step 6 submit | `POST /api/v1/application/step` (`step_count=6`) | Requires `uuid`; redirects to `/upload-document/{uuid}?redirect=1` on success |

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
5. **Interest details:** Loaded from `/api/partner/interest-details` as grouped checkboxes. The
   groups and slugs are defined by EMAP.

---

## Local storage

| Key | Value | When set | Cleared |
|---|---|---|---|
| `emap_uuid` | Application UUID from Step 1 response | After Step 1 succeeds | Step 6 success |
| `emap_country` | 2-char country code (e.g. `US`, `CA`) | After Step 1 succeeds | Step 6 success |
| `emap_step` | The step to resume at | After each step succeeds | Step 6 success |
| `emap_marketing_model` | Step 2 marketing-model answer, which controls later conditional fields | When the merchant changes it in Step 2 | Step 6 success |

`localStorage` is used (not `sessionStorage`) so the application survives accidental
tab closes and browser restarts. When the merchant reopens the page, the stored UUID is
read back and they can continue from where they left off without repeating Step 1.

Because this is per-browser, a shared computer (a shop counter, a family PC) would drop the
next person into the previous merchant's application. So whenever a saved application is
restored, the form shows "You're continuing a saved application. Not you? Start a new
application". That button clears all four keys and reloads the form. Keep it in any port.

All four keys are cleared on Step 6 success (application complete).

`emap_uuid` is sensitive: EMAP's step API accepts it as the only proof of access to the
application. Never display it, log it, or send it to analytics or error reporting.

---

## Partner key visibility

`EMAP_PARTNER_KEY` is a plain constant in client-side JS — it's visible to anyone who
views the page source. EMAP treats it as an attribution/referral value, not a credential
that grants access to anything; the realistic risk of leaving it exposed is another
site's signups being mis-attributed, not a security breach. See
`references/security-checklist.md` for the full tradeoff. Never commit a real partner
key to a public repo or log it to a third-party service.

---

## Testing

Test against EMAP's **test server** (`https://emap.epd.dev`) only, with an email address you
control. Never create test applications on production.

1. Keep `EMAP_BASE_URL` set to the test server.
2. Set `EMAP_PARTNER_KEY` (optional; signups work without it but won't be attributed).
3. Open `plain-html.html` directly in a browser (or serve it via any static file server —
   no build step required).
4. Complete all 6 steps with test data. Verify Step 6 sends the browser to
   `{EMAP_BASE_URL}/upload-document/{uuid}?redirect=1`.
5. Test the card percentage validator: set card_swiped + customer_entered + staff_entered ≠ 100.
   The form should block submission.
6. Test country → state conditional: select `US`, verify the state dropdown appears.
   Select a non-US country, verify it hides.
7. Test Owner 2: set ownership_percentage.1 < 51, verify Owner 2 section appears.
8. Test SSN mask (US/CA): verify Cleave.js formats input as `XXX-XX-XXXX`.
