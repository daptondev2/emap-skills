# Integration 3 — Email-Based Signup

Pure client-side. No backend, server, or `.env` file is used or needed — the form calls
EMAP's API directly from the browser.

## How it works

1. The **partner** (e.g. a sales rep) fills in the merchant's step-1 details on a form hosted on the partner's site.
2. The browser POSTs the data directly to EMAP `POST /api/v1/signup` with `trigger_email: true` and the partner key.
3. EMAP creates the merchant account and **emails the merchant a secure link** to complete the rest of their application on Easy Pay Direct's platform.
4. The partner sees a success message: "Signup email sent to [merchant email]."

The merchant is **not present** during this step — the partner registers them on their behalf. The merchant receives the email and completes the application independently.

**Use when:** a partner's sales team is onboarding merchants and wants to initiate the process without requiring the merchant to be on the partner's site.

---

## Templates

### `plain-html.html`
A standalone HTML form. Calls `EMAP_BASE_URL + '/api/v1/signup'` directly from the browser
via `fetch()`. EMAP's API sets CORS headers that allow this from any origin.

**Setup:** Set `EMAP_BASE_URL` and `EMAP_PARTNER_KEY` at the top of the `<script>` block.

### `SignupForm.tsx`
A Next.js **Client Component** (`'use client'`) wrapping the exact same tested markup,
styles, and logic as `plain-html.html`. There is no `app/api/*/route.ts` file — the
component calls EMAP's API directly from the browser, same as the plain HTML version.

**Use when:** you're building on Next.js and want to drop the form into an existing app.

**Setup:** Import and render `<SignupForm />` anywhere in your app. Set the same
`EMAP_BASE_URL` / `EMAP_PARTNER_KEY` constants inside the component's embedded script.

---

## Partner key visibility

`EMAP_PARTNER_KEY` is a plain constant in client-side JS — it's visible to anyone who
views the page source. EMAP treats it as an attribution/referral value, not a credential
that grants access to anything; the realistic risk of leaving it exposed is another
site's signups being mis-attributed, not a security breach. See
`references/security-checklist.md` for the full tradeoff. Never commit a real partner
key to a public repo or log it to a third-party service.

---

## Handling responses

EMAP returns HTTP 200 for most outcomes, including business-level errors. Always check the body:

| Body shape | Meaning | Your action |
|---|---|---|
| `{"status":true,"uuid":"..."}` | New account created; EMAP emailed the merchant a signup link | Show "Signup email sent to [email]" |
| `{"verificationLink":true,"url":"..."}` | Merchant already has an account; EMAP resent them the link | Show "A new signup link has been sent to [email]" |
| `{"status":false,"message":"Company already exists"}` | Duplicate company | Show warning; merchant may already have an account |
| HTTP 422 + `{"errors":{...}}` | Validation error | Show per-field errors |
| HTTP 429 | Rate limited | Show retry message |

See `../../references/api-errors.md` for the complete table and detection code.

---

## Testing

1. Set `EMAP_BASE_URL` to the staging URL from Easy Pay Direct.
2. Fill in a merchant's details and submit.
3. Verify the success panel appears with "Signup Email Sent!" and the merchant's email.
4. Verify the merchant receives an email from Easy Pay Direct with a link to complete their application.
5. Test error paths: duplicate email (422), missing required fields, rate limit (429).
