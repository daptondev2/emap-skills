# Integration 3: Email-Based Signup — Deep Reference

## Endpoint

```
POST {EMAP_BASE_URL}/api/v1/signup
Content-Type: application/json
Accept: application/json
```

Call this endpoint directly from the merchant's browser via `fetch()`. The integration is pure
client-side, with no backend of its own, so EMAP rate-limits by the merchant's IP. EMAP's API allows
these cross-origin calls via CORS. If EMAP limits that to registered partner sites, the partner's
origin must be registered with Easy Pay Direct.

`{EMAP_BASE_URL}` is `https://emap.epd.dev` (EMAP's **test server**) during development. Switch to
the production URL Easy Pay Direct gives you before launch. Don't create test applications on
production.

The form is filled in by the merchant, so all its wording speaks to the merchant: "Start Your
Merchant Application", "Email Me a Secure Link", "Check Your Email".

---

## Request body

```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@acme.com",
  "phone": "+12025551234",
  "name": "Acme Corp",
  "website": "https://acme.com",
  "country": "US",
  "annual_sales": 500000,
  "business_state": "CA",
  "industry_type": "e-commerce",
  "industry_type_other": "",
  "promo_code": "PARTNER20",
  "partner_key": "YOUR_EMAP_PARTNER_KEY",
  "trigger_email": true
}
```

### Field validation rules

| Field | Rule |
|---|---|
| `first_name` | required, string, max 255 |
| `last_name` | required, string, max 255 |
| `email` | required, valid email format. An email EMAP already knows returns the [existing-user response](#existing-emap-user), not an error |
| `phone` | required, string, max 20, digits/hyphens/plus/parentheses/spaces only |
| `name` | required, string, max 255 — **this is the company name** |
| `website` | required, string, valid URL pattern |
| `country` | required, string, must match a valid entry in EMAP's country table (e.g. `US`, `CA`, `GB`) |
| `annual_sales` | required, integer, min 1, max 999999999999 |
| `business_state` | required when country=US, string, max 2 chars, valid US state code (e.g. `CA`, `TX`) |
| `industry_type` | required, string — slug from `GET /api/partner/industry-types` (use the `slug` field, e.g. `e-commerce`) |
| `industry_type_other` | required when `industry_type` is `other` (compare case-insensitively; EMAP returns `Other`), string, max 255 |
| `promo_code` | optional, string, max 255 |
| `partner_key` | optional, string — your partner key from the partner portal (Integration → API Integration). An attribution value, not a secret |
| `trigger_email` | optional, boolean, default `false` — when `true`, EMAP dispatches the welcome/verification email as part of this same call. **Required for the Integration 3 email-signup flow**; without it, the account/application is created but no email is sent. |

---

## Response shapes

EMAP returns HTTP 200 for all business-logic outcomes (new user, existing user, company exists).
HTTP 422 is used only for field validation failures. Check the body to determine the actual result.

### New user (success)

```json
{
  "status": true,
  "message": "Success",
  "uuid": "a1b2c3d4-e5f6-..."
}
```

The `uuid` identifies the application, and anyone who holds it can continue that application.
Treat it like a password: **don't display it, log it, send it to analytics or store it.** The
template shows only "Check Your Email" and the address the link went to. The merchant continues
from the link in their email.

### Existing EMAP user

```json
{
  "message": "success",
  "verificationLink": true,
  "url": "https://emap.epd.dev/merchant/signup/verification/<token>"
}
```

The merchant already has an EMAP account, and EMAP has emailed them a verification link. Show the
same "Check Your Email" panel with a note that the email is already registered. Don't navigate to
`url`: the email is how EMAP confirms the person owns the address. Note: the `status` key is absent
in this shape. Detect it by checking for `verificationLink: true`.

### Company already exists

```json
{
  "status": false,
  "message": "Company already exists",
  "data": { ... }
}
```

The company name + country combination already exists in EMAP. Tell the merchant an application
already exists for this company and to check their inbox for an earlier email from Easy Pay Direct,
or contact its support team. Don't show anything from `data`.

### Validation failed (HTTP 422)

```json
{
  "status": false,
  "message": "Validation failed",
  "errors": {
    "email": ["This email address is already registered"],
    "business_state": ["Business state is required for US-based companies"]
  }
}
```

Display per-field errors to the merchant. Map the field names back to your form's input IDs.

### Server error (HTTP 400)

```json
{
  "status": false,
  "message": "Error while creating application",
  "data": "Something went wrong."
}
```

Show a generic "please try again" message. Do not surface the raw error to the merchant.

### Rate limited (HTTP 429)

Standard 429 response; the body may not be JSON. Re-enable the button and tell the merchant to try
again in a few minutes. Don't retry automatically.

---

## What happens after a successful submission

EMAP creates the merchant's account and application, runs its own review of the application, and,
because `trigger_email: true` was sent, emails the merchant. If a partner key was sent, the
application is attributed to that partner.

The merchant should expect:
- **New user:** an email with a link to set up access and continue at step 2.
- **Existing user:** an email with a verification link to access their application.

Emails can take a few minutes and may land in spam; the success panel says so.

---

## Example: cURL

For checking the API contract by hand on the **test server** only. A real integration never calls
EMAP from a terminal or server: the request must come from the merchant's browser.

```bash
curl -X POST https://emap.epd.dev/api/v1/signup \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "you+emap-test@your-domain.com",
    "phone": "+12025551234",
    "name": "Acme Corp",
    "website": "https://acme.com",
    "country": "US",
    "annual_sales": 500000,
    "business_state": "CA",
    "industry_type": "e-commerce",
    "partner_key": "YOUR_PARTNER_KEY",
    "trigger_email": true
  }'
```

---

## Response detection flowchart

```
HTTP status?
  ├── 429 → rate limited; show retry message
  ├── 422 → validation failed; show errors from response.errors
  ├── 400 → server error; show generic "please try again"
  └── 200 → check body:
        ├── response.verificationLink === true → existing user; show "Check Your Email" + note
        ├── response.status === true → new user; show "Check Your Email" (never the uuid)
        └── response.status === false → company exists or other error; check response.message
```
