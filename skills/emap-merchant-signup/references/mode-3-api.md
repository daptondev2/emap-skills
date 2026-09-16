# Integration 3: API Submission — Deep Reference

## Endpoint

```
POST {EMAP_BASE_URL}/api/v1/signup
Content-Type: application/json
Accept: application/json
```

Always call this endpoint from your backend. Never call it from browser-side JavaScript.

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
| `email` | required, valid RFC email format, must not already exist in EMAP's users table |
| `phone` | required, string, max 20, digits/hyphens/plus/parentheses/spaces only |
| `name` | required, string, max 255 — **this is the company name** |
| `website` | required, string, valid URL pattern |
| `country` | required, string, must match a valid entry in EMAP's country table (e.g. `US`, `CA`, `GB`) |
| `annual_sales` | required, integer, min 1, max 999999999999 |
| `business_state` | required when country=US, string, max 2 chars, valid US state code (e.g. `CA`, `TX`) |
| `industry_type` | required, string — slug from `GET /api/partner/industry-types` (use the `slug` field, e.g. `e-commerce`) |
| `industry_type_other` | required when `industry_type = other`, string, max 255 |
| `promo_code` | optional, string, max 255 |
| `partner_key` | optional, string — your partner `security_key` from EMAP |
| `partner_id` | optional, integer — your partner user ID in EMAP (alternative to `partner_key`) |
| `trigger_email` | optional, boolean, default `false` — when `true`, EMAP dispatches the welcome/verification email as part of this same call. **Required for the Integration 3 email-signup flow**; without it, the account/application is created but no email is sent, and you'd have to call `resume-link` separately to deliver it. |

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

The `uuid` is the application's UUID. You can display it in your confirmation page or store it for
reference. The merchant will also receive a welcome email with their password and a link to continue.

### Existing EMAP user

```json
{
  "message": "success",
  "verificationLink": true,
  "url": "https://emap.epd.dev/merchant/signup/verification/<token>"
}
```

The merchant already has an EMAP account. Redirect the merchant to `url` or tell them to check
their email — EMAP has sent a verification email. Note: `status` key is absent in this shape.
Detect it by checking for `verificationLink: true`.

### Company already exists

```json
{
  "status": false,
  "message": "Company already exists",
  "data": { ... }
}
```

The company name + country combination already exists in EMAP. Tell the merchant to check their
email for their existing application.

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

Standard 429 response. Implement exponential backoff. Tell the merchant to try again in a few minutes.

---

## What EMAP does after a successful submission

Understanding this helps you set the right expectations with the merchant.

1. **Creates records:** User, Company, Application records are created atomically.
2. **Fraud screening:** `ScreenApplicationForFraudJob` is queued. Scans the website asynchronously.
3. **Deal assignment:** The rules engine assigns a sales rep (deal owner) based on the application data.
4. **HubSpot sync:** Contact and deal objects are created/updated in HubSpot.
5. **Partner webhook:** If `partner_id` / `partner_key` is set, a webhook fires to notify the partner.
6. **Welcome email (new users):** if `trigger_email: true` was sent, `TriggerMerchantSignupEmail` dispatches with a password reset link.
7. **Verification email (existing users):** if `trigger_email: true` was sent, `MerchantSignupVerificationEmail` dispatches with a secure token URL.

The merchant should expect:
- **New user:** an email with their temporary password and a link to continue at step 2.
- **Existing user:** an email with a verification link to access their application.

---

## Resume link endpoint

The initial email is sent via `trigger_email: true` on the `/api/v1/signup` call above. Use this
endpoint only to resend the "Finish Later" email when the merchant requests it (e.g. it never arrived).

```
POST {EMAP_BASE_URL}/api/v1/signup/resume-link
Content-Type: application/json

{ "email": "merchant@example.com" }
```

**Response (always the same, whether or not the email exists):**
```json
{ "status": true, "message": "Resume link sent" }
```

EMAP always returns the same response to prevent email enumeration attacks. The email is sent
only if an account with that address exists and has an in-progress application.

**Rate limit:** 5 requests per 5 minutes per IP (on EMAP's side).
Implement your own rate limiting on your backend endpoint as well.

**Validation error (invalid email format):**
```json
{ "status": false, "message": "The email field must be a valid email address." }
```
HTTP 422.

---

## Example: cURL

```bash
curl -X POST https://emap.epd.dev/api/v1/signup \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
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
    "partner_key": "YOUR_PARTNER_KEY",
    "trigger_email": true
  }'
```

---

## Example: resume link cURL

```bash
curl -X POST https://emap.epd.dev/api/v1/signup/resume-link \
  -H "Content-Type: application/json" \
  -d '{"email": "jane@acme.com"}'
```

---

## Response detection flowchart

```
HTTP status?
  ├── 429 → rate limited; show retry message
  ├── 422 → validation failed; show errors from response.errors
  ├── 400 → server error; show generic "please try again"
  └── 200 → check body:
        ├── response.verificationLink === true → existing user; show verification message
        ├── response.status === true → new user; show success + "check your inbox"
        └── response.status === false → company exists or other error; check response.message
```
