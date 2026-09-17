# Integration 3 — Email-Based Signup

## How it works

1. The **partner** (e.g. a sales rep) fills in the merchant's step-1 details on a form hosted on the partner's site.
2. The partner's backend proxies the data to EMAP `POST /api/v1/signup` with the partner key.
3. EMAP creates the merchant account and **emails the merchant a secure link** to complete the rest of their application on Easy Pay Direct's platform.
4. The partner sees a success message: "Signup email sent to [merchant email]."

The merchant is **not present** during this step — the partner registers them on their behalf. The merchant receives the email and completes the application independently.

**Use when:** a partner's sales team is onboarding merchants and wants to initiate the process without requiring the merchant to be on the partner's site.

---

## Templates

### `plain-html.html`
A standalone HTML form. POSTs to `/api/signup` on your backend, which then calls EMAP's API.

**Important:** This form must NOT call EMAP's API directly. Always proxy through your backend so that `EMAP_PARTNER_KEY` stays server-side.

### `node-express.js`
An Express.js backend proxy. Receives form data, validates it, calls EMAP's API with your partner key, and returns the result to the browser.

**Dependencies:** `npm install express dotenv node-fetch@2`

### `php-vanilla.php`
A single-file PHP implementation: includes both the HTML form and the backend proxy logic. Handles CSRF protection with PHP sessions.

**Requirements:** PHP 7.4+ with `curl` extension enabled.

### `nextjs-route.ts`
A Next.js App Router route handler for `app/api/signup/route.ts`. TypeScript. Uses the built-in `fetch` API.

---

## Environment variables

Create a `.env` file (never commit it):
```
EMAP_BASE_URL=https://emap.epd.dev
EMAP_PARTNER_KEY=your_partner_key_here
PORT=3000
```

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
