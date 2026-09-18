# Integration 2 Templates

Pure client-side. No backend, server, or `.env` file is used or needed — the redirect URL
is built entirely in the browser.

## Templates

### `plain-html.html`
A complete standalone HTML page. The form collects step-1 data and on submit redirects
the browser to EMAP's `/signup` with all values as query parameters, built entirely
client-side.

**Use when:** you have a static site, a CMS with no custom server code, or you want the
simplest possible integration.

**Setup:** Set `EMAP_BASE_URL` at the top of the `<script>` block. Optionally set
`EMAP_PARTNER_SECRET_KEY` if you have a partner key — see the Partner key visibility
section below for the client-visibility tradeoff.

### `SignupForm.tsx`
A Next.js **Client Component** (`'use client'`) wrapping the exact same tested markup,
styles, and logic as `plain-html.html`. There is no `app/api/*/route.ts` file — the
redirect URL is built and followed entirely in the browser, same as the plain HTML version.

**Use when:** you're building on Next.js and want to drop the form into an existing app.

**Setup:** Import and render `<SignupForm />` anywhere in your app. Set the same
`EMAP_BASE_URL` / `EMAP_PARTNER_SECRET_KEY` constants inside the component's embedded script.

---

## Customisation

1. **Styling:** Replace the inline CSS with your own classes. The templates use minimal styles only.
2. **Fields:** Add or remove optional fields. Required fields (`first_name`, `last_name`, `email`,
   `phone`, `company_name`, `website`, `country`, `annual_sales`) must stay.
3. **Auto-submit:** To trigger EMAP's auto-submit, include all the optional fields listed in
   [`../../references/field-catalog.md`](../../references/field-catalog.md) under "Auto-submit fields".

---

## Partner key visibility

`EMAP_PARTNER_SECRET_KEY` is a plain constant in client-side JS — it's visible to anyone
who views the page source, and it also appears in the redirect URL itself (address bar,
browser history, referrer headers). EMAP treats it as a low-risk referral code, not a
secret API key — the same value is already used in EMAP's public `/go/{code}` referral
links. See `references/security-checklist.md` for the full tradeoff and mitigations
(e.g. `Referrer-Policy: no-referrer`). Never commit a real partner key to a public repo
or log it to a third-party service.

---

## Testing

1. Set `EMAP_BASE_URL` to the EMAP staging URL.
2. Fill in the form and submit.
3. Verify you are redirected to EMAP with the fields pre-filled.
4. For full auto-submit: include all non-excluded fields, verify EMAP auto-submits and you
   land on step 2.
