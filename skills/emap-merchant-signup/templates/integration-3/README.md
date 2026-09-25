# Integration 3 — Email-Based Signup

Works in any tech stack. No server-side code is involved: the form calls EMAP's API directly
from the browser.
Keep it that way. EMAP rate-limits signups by the caller's IP, so the requests must come from
the merchant's browser, not from a server proxy.

## How it works

1. The **merchant** fills in their step-1 details on a form hosted on the partner's site.
   Once name, email and phone are filled in, the browser auto-saves them to
   `POST /api/v1/signup/auto-save` in the background (EMAP creates the user and HubSpot contact).
2. The merchant's browser POSTs the data directly to EMAP `POST /api/v1/signup` with
   `trigger_email: true` and the partner key.
3. EMAP creates the account and **emails the merchant a secure link** to finish the application on
   Easy Pay Direct's platform.
4. The form shows "Check Your Email" with a summary of what was submitted and the address the
   link went to.

Every word on the form speaks to the merchant: "Start Your Merchant Application", "Email Me a
Secure Link", "Check Your Email".

**Use when:** you want a short form on your site, and the merchant finishes the application from a
link in their email rather than on your site (Integration 1) or by being redirected straight to
EMAP (Integration 2).

---

## Templates

### `plain-html.html`
A standalone HTML form. Calls `EMAP_BASE_URL + '/api/v1/signup'` directly from the browser
via `fetch()`. EMAP's API allows this cross-origin call via CORS. If EMAP limits that to
registered partner sites, register your site's origin with Easy Pay Direct.

**Setup:** Set `EMAP_BASE_URL` and `EMAP_PARTNER_KEY` at the top of the `<script>` block. The
template ships with `https://emap.epd.dev`, EMAP's **test server**; switch to the production URL at
launch.

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
| `{"status":true,"uuid":"..."}` | New account created; EMAP emailed the merchant a link | Show "Check Your Email". Never display or log the `uuid`: anyone holding it can continue the application |
| `{"verificationLink":true,"url":"..."}` | The email already has an account; EMAP emailed a verification link | Show "Check Your Email" with a note that the email is already registered. Don't link to or navigate to `url` |
| `{"status":false,"message":"Company already exists"}` | An application for this company already exists | Tell the merchant to check their inbox for an earlier email from Easy Pay Direct, or contact their support team |
| HTTP 422 + `{"errors":{...}}` | Validation error | Show per-field errors |
| HTTP 429 | Rate limited | Ask the merchant to wait a few minutes. Don't retry automatically |

See `../../references/api-errors.md` for the complete table and detection code.

---

## Testing

Test against EMAP's **test server** (`https://emap.epd.dev`) only, with an email address you
control. Never create test applications on production.

1. Keep `EMAP_BASE_URL` set to the test server.
2. Fill in the form and submit.
3. Verify the "Check Your Email" panel shows your details and email address, and no application ID.
4. Verify the email from Easy Pay Direct arrives with a link to continue the application.
5. Submit again with the same email and a different company. Verify the panel adds the
   "already have an account" note and the page shows no link.
6. Submit a company name that already exists. Verify the warning appears and the button is
   enabled again.
7. Leave a required field empty and verify the form blocks the submit.
