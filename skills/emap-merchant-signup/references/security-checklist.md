# Security Checklist

Complete every item before going live. Items marked **[CRITICAL]** are blockers.

Every integration here is pure client-side — HTML+CSS+JS, or a Next.js Client Component. There is
no backend, no server endpoint of this form's own, and no `.env` file for any of it. This checklist
reflects that: several items from a typical "backend proxy" checklist genuinely don't apply and are
called out as such, not because they were skipped, but because there's no backend for them to apply
to.

---

## Transport

- [ ] **[CRITICAL] HTTPS on your site.** The form page itself must be served over HTTPS.
  Redirect all HTTP requests to HTTPS. Verify with `curl -I http://yourdomain.com/apply`.

- [ ] **[CRITICAL] HSTS header.** Add to your static host / CDN's response headers:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  ```

- [ ] **[CRITICAL] `EMAP_BASE_URL` pinned to the official host.**
  Set the `EMAP_BASE_URL` constant in the file to `https://emap.epd.dev` (or the staging URL from
  Easy Pay Direct). Never construct this value from user-supplied input.

---

## Partner key exposure (not "secrets management" — there is nothing to keep secret here)

This form calls EMAP directly from the browser, so `EMAP_PARTNER_KEY` / `EMAP_PARTNER_SECRET_KEY`
is necessarily visible in the deployed page's JavaScript source to anyone who looks. That is the
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
  Handled at every layer that exists — nothing left for you to add:
  - **Client** (`plain-html.html` / `SignupForm.tsx`, all 3 integrations): if `_hp` is non-empty
    on submit, the JS returns silently without calling EMAP at all.
  - **EMAP API itself** (`/api/v1/signup`): accepts an optional `_hp` field and, if filled,
    returns a fake success response with no database writes and no jobs dispatched — a second
    layer, reachable directly since there's no backend of this form's own in between.

- [ ] **Rate limiting.** There is no endpoint of this form's own to rate-limit — EMAP's own API
  enforces this itself (its `externalSignup` endpoint limits new-signup attempts per source IP).
  Nothing to configure here.

- [ ] **Double-submit prevention.** Disable the submit button immediately on first click.
  Re-enable only on 422 (validation error) so the merchant can correct and resubmit. Already done
  in the templates (`btn.disabled = true` in `submitStep`/the submit handler) — verify it's still
  intact if you modified that code.

---

## Privacy — Integration 2 (redirect)

- [ ] **[CRITICAL] `Referrer-Policy: no-referrer` on the form page response header.**
  This prevents the EMAP URL (which contains PII in the query string) from being sent
  as the `Referer` header to analytics and tracking scripts loaded on the EMAP page.
  ```
  Referrer-Policy: no-referrer
  ```
  Also add the meta tag as a fallback:
  ```html
  <meta name="referrer" content="no-referrer">
  ```

- [ ] **No PII in browser storage.** Don't save form values to `localStorage` or `sessionStorage`
  beyond what the template already does (Integration 1's `emap_uuid`/`emap_step` session-resume
  keys, which hold no PII themselves).

---

## Privacy — Integration 1 and 3

- [ ] **`Cache-Control: no-store` on the form page**, where your static host allows setting
  response headers. Prevents browser caching of a page that may contain PII the merchant typed.

- [ ] **Never `console.log` the request payload** anywhere in the JS — it contains name, email,
  phone, and (in Integration 1) SSN/banking details. If you add debug logging while modifying a
  template, remove it before deploying.

- [ ] **Nothing is persisted anywhere except EMAP.** There is no database of this form's own —
  confirm you haven't added one. EMAP is the system of record; use the returned `uuid` for any
  confirmation UI instead of storing merchant data yourself.

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

- [ ] **Content-Security-Policy header** on your form page, where your static host allows setting
  response headers. Restrict scripts to your domain plus the CDN this form actually loads from:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://emap.epd.dev; style-src 'self' 'unsafe-inline'
  ```
  `connect-src` must include your `EMAP_BASE_URL` origin — the browser will block the `fetch()`
  calls to EMAP without it. Adjust `script-src` if you use a different CDN than the Cleave.js one
  in the templates.

- [ ] **X-Frame-Options or CSP frame-ancestors** to prevent clickjacking:
  ```
  X-Frame-Options: DENY
  ```

---

## Pre-launch verification

- [ ] **Test on EMAP staging** before pointing `EMAP_BASE_URL` to production. Verify the full flow
  end-to-end.
- [ ] **Test error paths:** submit with an invalid email, missing required fields, duplicate email.
  Verify the on-page error handling works for each.
- [ ] **Integration 2:** Verify the merchant lands on the correct EMAP page (prefilled or
  auto-submitted). Check that the `Referer` header is absent on EMAP's side.
- [ ] **Integration 3:** Verify the welcome email arrives. Check the `uuid` is in the response.
- [ ] **Next.js only:** confirm no `app/api/*/route.ts` file exists for this integration — if one
  does, it was built wrong (see SKILL.md's Guardrails).
