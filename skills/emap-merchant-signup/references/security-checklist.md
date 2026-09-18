# Security Checklist

Complete every item before going live. Items marked **[CRITICAL]** are blockers.

The form can be built in any tech stack, but every EMAP request is made by the merchant's browser.
There is no server endpoint of this form's own, no server-side proxy to EMAP, and no `.env` file
for any of it. The partner's site can have its own backend for other things, but it never calls
EMAP (see `stack-guide.md`), because EMAP rate-limits signups by the caller's IP. This checklist
reflects that: several items from a typical "backend proxy" checklist genuinely don't apply and are
called out as such, not because they were skipped, but because there's no backend for them to apply
to.

---

## Transport

- [ ] **[CRITICAL] HTTPS on your site.** The form page itself must be served over HTTPS.
  Redirect all HTTP requests to HTTPS. Verify with `curl -I http://yourdomain.com/apply`.

- [ ] **HSTS header (recommended).** Once the whole site is reliably on HTTPS, add:
  ```
  Strict-Transport-Security: max-age=31536000
  ```
  Only add `includeSubDomains` if **every** subdomain serves HTTPS; otherwise it breaks the ones
  that don't. Start with a short `max-age` if you're unsure.

- [ ] **[CRITICAL] `EMAP_BASE_URL` points at EMAP's production host.** The templates ship with
  `https://emap.epd.dev`, EMAP's **test server**. Before launch, set it to the production URL Easy
  Pay Direct gives you. Never construct this value from user-supplied input.

---

## Partner key exposure (not "secrets management" — there is nothing to keep secret here)

This form calls EMAP directly from the browser, so `EMAP_PARTNER_KEY` (sent as `partner_key`, or
as the `secretKey` URL param in Integration 2) is necessarily visible in the deployed page's JavaScript source to anyone who looks. That is the
accepted tradeoff of this architecture (see SKILL.md Step 2), not a bug to fix by adding a backend.
What still matters:

- [ ] **Confirmed with the developer** that they're comfortable with the key being publicly
  visible client-side, or they've deliberately left it `''` to skip attribution instead.
- [ ] **[CRITICAL] Real key value not committed to a public source repo's git history**, even
  though it's fine in the deployed page — "in the deployed HTML" and "in git history / a leaked
  private repo" are different exposure surfaces, and only the first is accepted.
- [ ] **Never printed to any third-party analytics, error tracker, or log aggregator** — those
  can index and retain it indefinitely in a way a page's HTML doesn't.

---

## Form security

- [ ] **EMAP's own server-side validation is the real gate — do not weaken it.** This form's
  client-side checks are for UX only; a user who calls EMAP directly can bypass them, and that was
  already true before this form existed (no backend of this form's own can prevent it either).
  Do not remove or loosen a client-side check thinking it needs to "match" a backend — there isn't
  one.

- [x] **Honeypot field.** Built into all 3 integration templates: a hidden `_hp` field
  (`name="_hp"`, `tabindex="-1"`, `autocomplete="off"`) that real users never fill.
  ```html
  <input class="hp-field" name="_hp" tabindex="-1" autocomplete="off">
  ```
  In every template (`plain-html.html` / `SignupForm.tsx` / any port of them), if `_hp` is
  non-empty on submit, the JS returns silently without calling EMAP. This only stops simple bots
  that run the page. A bot that calls EMAP's API directly never sees the form, so the real spam
  defences have to be on EMAP's side (rate limits, a challenge such as CAPTCHA, and email
  verification). Keep the field when porting; don't treat it as enough on its own.

- [ ] **Rate limiting.** There is no endpoint of this form's own to rate-limit. EMAP limits
  signups by the caller's IP, which is why every call comes from the merchant's browser. Nothing
  to configure here, but don't add a server proxy: it would put every merchant behind one IP.

- [ ] **Double-submit prevention.** Disable the submit button immediately on first click.
  Re-enable it only on a failed request (422, 429, 5xx, network error) so the merchant can correct
  and resubmit. Already done
  in the templates (`btn.disabled = true` in `submitStep`/the submit handler) — verify it's still
  intact if you modified that code.

---

## Privacy — Integration 2 (redirect)

- [ ] **Developer told that the redirect URL carries PII.** The merchant's name, email and phone
  are in the query string of EMAP's `/signup` URL, so they reach the browser history and EMAP's
  logs, and can leak in the `Referer` header of anything EMAP's page loads. A `Referrer-Policy` on
  the partner's page doesn't help: the PII is in the URL of EMAP's page, and only EMAP can control
  what that page sends. If this is unacceptable, use Integration 3 (POST body) instead.

- [ ] **The redirect URL isn't logged.** No analytics event, error report or `console.log` on the
  partner's page includes it.

---

## Privacy — all integrations

- [ ] **The application `uuid` is treated like a password.** Anyone holding it can continue that
  application. Never display it, log it, or send it to analytics or an error tracker. Integration
  3's success panel doesn't show it; keep it that way.

- [ ] **No PII in browser storage.** Don't save form values to `localStorage` or `sessionStorage`
  beyond what the template already does: Integration 1's `emap_uuid`, `emap_country`, `emap_step`
  and `emap_marketing_model` resume keys. None of them is PII, but `emap_uuid` is sensitive (see
  above). Keep Integration 1's "Not you? Start a new application" notice, so the next person on a
  shared computer can discard a saved application instead of continuing it.

- [ ] **Existing-user responses don't link to EMAP's verification `url`.** The templates only tell
  the merchant to check their email; the email is what proves they own the address.

---

## Privacy — Integration 1 and 3

- [ ] **`Cache-Control: no-store` on the form page**, where your static host allows setting
  response headers. Prevents browser caching of a page that may contain PII the merchant typed.

- [ ] **Never `console.log` the request payload** anywhere in the JS — it contains name, email,
  phone, and (in Integration 1) SSN/banking details. If you add debug logging while modifying a
  template, remove it before deploying.

- [ ] **Nothing is persisted anywhere except EMAP.** There is no database of this form's own —
  confirm you haven't added one. EMAP is the system of record.

---

## UX security

- [ ] **Generic user-facing error messages.** The templates already map EMAP's error responses to
  friendly text (`showAlert`) rather than surfacing EMAP's raw error strings — verify this is still
  true if you modified the error-handling code.

- [ ] **429 handling.** If EMAP returns 429 (its own rate limit), the templates already tell the
  merchant to wait and retry — verify this is still true if you modified `submitStep`/the fetch
  error handling.

---

## Content security

- [ ] **Content-Security-Policy header** on your form page, where your host allows setting
  response headers. A starting point:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'nonce-<RANDOM>'; connect-src 'self' <EMAP_BASE_URL origin>; style-src 'self' 'unsafe-inline'; frame-ancestors 'self'
  ```
  - `connect-src` must include the `EMAP_BASE_URL` origin (the production one at launch), or the
    browser blocks every call to EMAP.
  - The templates' logic is an **inline** `<script>`, which `script-src 'self'` alone blocks.
    Either move it to a `.js` file on your domain, or allow it with a per-response `nonce` (or a
    `sha256-` hash of the exact script). Don't use `'unsafe-inline'` for scripts.
  - `SignupForm.tsx` injects its logic as a `<script>` element at runtime, so under a strict CSP
    it needs the same nonce (set `nonce` on that element) or `'strict-dynamic'`.
  - `https://cdn.jsdelivr.net` is only needed for Integration 1, which loads Cleave.js. That tag
    carries an `integrity` hash; keep it if you change the URL (cdnjs serves the same file with the
    same hash). Or self-host the file and drop the CDN.

- [ ] **X-Frame-Options or CSP frame-ancestors** to prevent clickjacking:
  ```
  X-Frame-Options: DENY
  ```
  If you embed the form in an iframe on your own site, use `SAMEORIGIN` /
  `frame-ancestors 'self'` instead.

---

## Pre-launch verification

- [ ] **Test on EMAP's test server** (`https://emap.epd.dev`) end to end, with email addresses you
  control, before pointing `EMAP_BASE_URL` at production. Never create test applications on
  production.
- [ ] **Test error paths:** submit with an invalid email, missing required fields, duplicate email.
  Verify the on-page error handling works for each.
- [ ] **Integration 2:** Verify the merchant lands on the right EMAP page: step 2 when every field
  is valid, EMAP's prefilled form otherwise.
- [ ] **Integration 3:** Verify "Check Your Email" appears, the `uuid` isn't shown anywhere on the
  page, and the email arrives.
- [ ] **No server-side code calls EMAP**, in any stack. Check for route handlers and API routes,
  Server Actions, loaders and actions, SSR data fetching (Nuxt `useFetch` on the server, SvelteKit
  `load`), controllers, `curl` / `wp_remote_post`, and serverless functions. If one exists, the
  integration was built wrong (see SKILL.md's Guardrails and `stack-guide.md`).
