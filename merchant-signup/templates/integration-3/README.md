# Integration 3 Templates

## Templates

### `plain-html.html`
A complete standalone HTML form that POSTs JSON to your backend at `/api/signup`.
The backend (one of the templates below) then calls EMAP's API.

**Important:** This form must NOT call EMAP's API directly. Always proxy through your backend
so that `EMAP_PARTNER_KEY` stays server-side.

### `node-express.js`
An Express.js backend proxy. Receives form data, validates it, calls EMAP's API with your
partner key, and returns the result to the browser.

**Dependencies:** `npm install express dotenv node-fetch@2`

### `php-vanilla.php`
A single-file PHP implementation: includes both the HTML form and the backend proxy logic.
Handles CSRF protection with PHP sessions.

**Requirements:** PHP 7.4+ with `curl` extension enabled.

### `nextjs-route.ts`
A Next.js App Router route handler for `app/api/signup/route.ts`.
TypeScript. Uses the built-in `fetch` API.

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
| `{"status":true,"uuid":"..."}` | New user created | Show "Check your inbox" |
| `{"verificationLink":true,"url":"..."}` | Existing user | Show message or redirect to `url` |
| `{"status":false,"message":"Company already exists"}` | Duplicate company | Show message |
| HTTP 422 + `{"errors":{...}}` | Validation error | Show per-field errors |
| HTTP 429 | Rate limited | Show retry message |

See `../../references/api-errors.md` for the complete table and detection code.

---

## Resume link

To resend the continuation email, POST to your own backend endpoint which proxies
`POST {EMAP_BASE_URL}/api/v1/signup/resume-link`. See `node-express.js` for the implementation.

---

## Testing

1. Set `EMAP_BASE_URL` to the staging URL from Easy Pay Direct.
2. Submit the form with a unique test email.
3. Verify you receive `{"status":true,"uuid":"..."}` and a welcome email.
4. Test the error paths: duplicate email (422), invalid email format, missing required fields.
