# Security Checklist

Complete every item before going live. Items marked **[CRITICAL]** are blockers.

---

## Transport

- [ ] **[CRITICAL] HTTPS on your site.** Both the form page and your backend endpoint must use HTTPS.
  Redirect all HTTP requests to HTTPS. Verify with `curl -I http://yourdomain.com/apply`.

- [ ] **[CRITICAL] HSTS header.** Add to your server response:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  ```

- [ ] **[CRITICAL] `EMAP_BASE_URL` pinned to official host.**
  Set to `https://emap.epd.dev` (or the staging URL from Easy Pay Direct).
  Never construct the URL from user-supplied input.

---

## Secrets

- [ ] **[CRITICAL] Partner key in environment only.** `EMAP_PARTNER_KEY` and
  `EMAP_PARTNER_SECRET_KEY` must be in `.env` or a secret manager.
  **Never** in source code, never committed to git, never sent to the browser, never in logs.

- [ ] **[CRITICAL] `.env` is git-ignored.** Verify:
  ```bash
  git check-ignore -v .env   # should output: .gitignore:.env
  ```

- [ ] **[CRITICAL] Key is not in any JS bundle.**
  ```bash
  grep -r "EMAP_PARTNER" dist/ public/ build/   # should return nothing
  ```

- [ ] **Check browser network tab.** Open DevTools → Network, submit the form, verify no request
  contains the partner key in its body, headers, or URL.

---

## Form security

- [ ] **[CRITICAL] Backend validation** before forwarding to EMAP. Validate required fields and
  format on your server. Don't rely solely on EMAP's 422 responses.

- [ ] **CSRF protection** on your backend form endpoint.
  - Express: `csurf` middleware or custom `SameSite=Strict` cookie check.
  - Laravel: built-in CSRF middleware (default).
  - Next.js: set `SameSite=Strict` on your session cookie plus a custom `X-Requested-With` header check.
  - PHP: session-based CSRF token (see `php-vanilla.php` template).

- [ ] **Honeypot field.** Add a hidden field (e.g. `name="_hp"`) that real users never fill.
  Reject submissions silently if it contains a value.
  ```html
  <input name="_hp" style="display:none" tabindex="-1" autocomplete="off">
  ```

- [ ] **Rate limiting on your endpoint.** Recommended: 10 submissions per hour per IP.
  Example (Express + `express-rate-limit`):
  ```javascript
  const rateLimit = require('express-rate-limit');
  app.use('/api/signup', rateLimit({ windowMs: 60*60*1000, max: 10 }));
  ```

- [ ] **Double-submit prevention.** Disable the submit button immediately on first click.
  Re-enable only on 422 (validation error) so the merchant can correct and resubmit.

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

- [ ] **Don't store the redirect URL** in your database, server logs, or analytics events.
  Build it fresh on each request.

- [ ] **No PII in browser storage.** Don't save form values to `localStorage` or `sessionStorage`.

---

## Privacy — Integration 3 (API)

- [ ] **`Cache-Control: no-store` on the form page.** Prevents browser caching of PII.

- [ ] **PII not persisted in your database** after forwarding to EMAP.
  EMAP is the system of record. If you need to show a confirmation, use the returned `uuid`.

- [ ] **Never log the request payload** — it contains name, email, phone.
  Log errors by message only, not by the full request body.

---

## UX security

- [ ] **Generic user-facing error messages.** Map EMAP's internal errors to friendly messages
  in your backend. Never surface EMAP's raw error text to the merchant.

- [ ] **429 handling with backoff.** If EMAP returns 429, tell the merchant to wait before retrying.
  Implement exponential backoff on automated retries (if any).

---

## Content security

- [ ] **Content-Security-Policy header** on your form page. Restrict scripts to your domain.
  Example:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
  ```
  Adjust for any CDN assets you use (fonts, intl-tel-input, etc.).

- [ ] **X-Frame-Options or CSP frame-ancestors** to prevent clickjacking:
  ```
  X-Frame-Options: DENY
  ```

---

## Pre-launch verification

- [ ] **Test on EMAP staging** before pointing to production. Verify the full flow end-to-end.
- [ ] **Test error paths:** submit with an invalid email, missing required fields, duplicate email.
  Verify your error handling works for each.
- [ ] **Integration 2:** Verify the merchant lands on the correct EMAP page (prefilled or auto-submitted).
  Check that the `Referer` header is absent on EMAP's side.
- [ ] **Integration 3:** Verify the welcome email arrives. Check the `uuid` is in the response.
- [ ] **Check dependencies are pinned.** Avoid `^` ranges in `package.json` for production deployments.
