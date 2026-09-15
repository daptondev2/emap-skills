# Integration 1: Full Form — Deep Reference

Integration 1 hosts the complete EMAP 6-step merchant signup on the partner's site.
Each step is a separate API call from your backend to EMAP. The merchant never visits
the EMAP domain.

---

## Overview of EMAP endpoints used

| Step | Your backend route | EMAP endpoint | Request type |
|---|---|---|---|
| 1 | `POST /api/step/1` | `POST /api/v1/signup` | `ExternalSignupRequest` |
| 2 | `POST /api/step/2` | `POST /api/v1/application/step` | `ApplicationStepRequest` (`step_count=2`) |
| 3 | `POST /api/step/3` | `POST /api/v1/application/step` | `ApplicationStepRequest` (`step_count=3`) |
| 4 | `POST /api/step/4` | `POST /api/v1/ownership` | `HandleOwnershipRequest` |
| 5 | `POST /api/step/5` | `POST /api/v1/application/step` | `ApplicationStepRequest` (`step_count=5`) |
| 6 | `POST /api/step/6` | `POST /api/v1/application/step` | `ApplicationStepRequest` (`step_count=6`) |

The `uuid` returned by Step 1 must be included in every subsequent request.

---

## Step 1 — Basic business info

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/signup`

### Request body

```json
{
  "first_name": "Jane",
  "last_name":  "Smith",
  "email":      "jane@acme.com",
  "phone":      "+12025551234",
  "name":       "Acme Corp",
  "website":    "https://acme.com",
  "country":    "US",
  "annual_sales": 500000,
  "business_state": "CA",
  "promo_code": "PARTNER20",
  "partner_key": "YOUR_EMAP_PARTNER_KEY"
}
```

### Field rules

| Field | Required | Type | Constraints |
|---|---|---|---|
| `first_name` | Yes | string | max 255 |
| `last_name` | Yes | string | max 255 |
| `email` | Yes | string | valid email; unique in EMAP |
| `phone` | Yes | string | max 20; digits, `+`, `-`, `(`, `)`, spaces |
| `name` | Yes | string | max 255 — company name |
| `website` | Yes | string | valid URL pattern |
| `country` | Yes | string | 2-char ISO code (`US`, `CA`, `GB`, …) |
| `annual_sales` | Yes | integer | min 1, max 999 999 999 999 |
| `business_state` | Required if country=US | string | 2-char US state code |
| `promo_code` | No | string | max 255 |
| `partner_key` | No | string | inject from env; never from browser |

### Response

Same shapes as Integration 3. See [`api-errors.md`](api-errors.md) for the full table.

On success: `{ "status": true, "uuid": "<uuid>" }`. Store the `uuid` in `localStorage`.

---

## Step 2 — Business details (ApplicationStepRequest, step_count=2)

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/application/step`

### Key fields

| Field | Required | Notes |
|---|---|---|
| `uuid` | Yes | From Step 1 |
| `step_count` | Yes | Must be `2` |
| `industry_type` | No | Slug from `/api/partner/industry-types` |
| `business_organized` | Yes | Slug: `sole-proprietor`, `llc`, `corporation`, `partnership`, `non-profit` |
| `business_location` | Yes | Slug: `home`, `office`, `retail-store`, `online-only` |
| `federal_tax_id` | Required for US LLCs/Corps | EIN in `XX-XXXXXXX` format |
| `business_register_number` | Required for CA businesses | Canadian business number |
| `address` | Yes | Street address |
| `address_city` | Yes | City |
| `address_state` | Required if address_country=US | 2-char state code |
| `address_zip` | Yes | Postal/ZIP code |
| `address_country` | Yes | 2-char ISO country code |
| `years_in_business` | Yes | Integer |
| `physical_address_different` | Yes | `1` = different, `0` = same as business address |
| `physical_address` | Required if physical_address_different=1 | Street |
| `physical_address_city` | Required if physical_address_different=1 | City |
| `physical_address_state` | Required if physical_address_different=1 and country=US | State |
| `physical_address_zip` | Required if physical_address_different=1 | ZIP |
| `physical_address_country` | Required if physical_address_different=1 | 2-char ISO |

---

## Step 3 — Processing info (ApplicationStepRequest, step_count=3)

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/application/step`

### Key fields

| Field | Required | Notes |
|---|---|---|
| `uuid` | Yes | From Step 1 |
| `step_count` | Yes | Must be `3` |
| `refund_policy` | Yes | Slug: `no-refunds`, `30-days`, `60-days`, `90-days`, `other` |
| `fulfillment_by` | Yes | Slug: `merchant`, `vendor`, `others` |
| `fullfillment_company` | Required if fulfillment_by is `vendor` or `others` | Company name (note: two l's) |
| `shopping_cart` | Yes | Slug from `/api/partner/shopping-carts`, or `api`, or `other` |
| `shopping_cart_other` | Required if shopping_cart=`other` | Text description |
| `customer_service_time` | Yes | Slug: `less-than-24`, `24-48`, `48-72`, `more-than-72` |
| `transaction_device` | Yes | Slug: `online`, `retail`, `both` |
| `card_swiped` | Yes | Integer 0–100; percentage of transactions swiped |
| `customer_entered` | Yes | Integer 0–100; keyed by customer |
| `staff_entered` | Yes | Integer 0–100; keyed by staff |
| `marketing_model` | Yes | Array of integers from `/api/partner/interest-details` mapped values |
| `subscription_frequency` | Required if marketing_model includes 2 or 3 | `1`=Weekly `2`=Monthly `3`=Other |
| `subscription_frequency_other` | Required if subscription_frequency=3 | Text description |
| `primary_contact` | Yes | `1`=Owner is primary contact `0`=Other person |
| `primary_contact_first_name` | Required if primary_contact=0 | Max 60 |
| `primary_contact_last_name` | Required if primary_contact=0 | Max 60 |
| `primary_contact_email` | Required if primary_contact=0 | Valid email |
| `primary_contact_job_title` | Required if primary_contact=0 | Max 100 |

**Card percentage rule:** `card_swiped + customer_entered + staff_entered` must equal exactly 100.

---

## Step 4 — Ownership info (HandleOwnershipRequest)

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/ownership`

Fields use dot-notation names (e.g. `first_name.1`, `ssn.1`). The number suffix is the owner index.
Owner 2 is required when Owner 1's `ownership_percentage.1 < 51`.

### Owner fields (repeat with `.2` suffix for Owner 2)

| Field | Required | Notes |
|---|---|---|
| `uuid` | Yes | From Step 1 |
| `first_name.1` | Yes | Max 60 |
| `last_name.1` | Yes | Max 60 |
| `email.1` | Yes | Valid email |
| `owner_job_title.1` | Yes | Slug from static list |
| `ownership_percentage.1` | Yes | Integer 1–100; whole numbers only |
| `dob.1` | Yes | Date; format `YYYY-MM-DD`; owner must be 18–100 years old |
| `ssn.1` | Yes (US/CA) | US: `XXX-XX-XXXX` (SSN); CA: `XXX-XX-XXXX` (SIN). Other countries: plain tax ID. |
| `country.1` | Yes | 2-char ISO; drives SSN label and state field |
| `address.1` | Yes | Street address |
| `city.1` | Yes | City |
| `state.1` | Required if country.1=US | 2-char US state code |
| `zip.1` | Yes | Postal/ZIP code |
| `driver_license_number.1` | Yes | Driver license number |
| `driver_license_state.1` | Required if country.1=US | 2-char state code |
| `driver_license_expiration_date.1` | Yes | Must be a future date |
| `bankruptcy_filed.1` | Yes | `1`=Yes `0`=No |
| `bankruptcy_type.1` | Required if bankruptcy_filed.1=1 | Chapter type |
| `bankruptcy_discharged.1` | Required if bankruptcy_filed.1=1 | `1`=Yes `0`=No |
| `bankruptcy_discharged_date.1` | Required if bankruptcy_discharged.1=1 | Must be a past date |

**SSN/DOB/bank data: never store or log these values. Send over HTTPS only.**

---

## Step 5 — Bank info (ApplicationStepRequest, step_count=5)

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/application/step`

### Key fields

| Field | Required | Notes |
|---|---|---|
| `uuid` | Yes | From Step 1 |
| `step_count` | Yes | Must be `5` |
| `bank_name` | Yes | Bank name |
| `bank_routing_number` | Yes | 9-digit ABA routing number |
| `bank_account_number` | Yes | Account number |
| `bank_account_type` | Yes | `1`=Checking `2`=Savings |
| `institution_number` | Required if country=CA | Canadian institution number |
| `customer_pay_currency` | Required if country=CA | Currency code (e.g. `CAD`) |
| `current_processing` | Yes | `1`=Currently processing cards `0`=Not currently |
| `processor_name` | Required if current_processing=1 | Current processor name |
| `bad_experience` | Yes | `1`=Had a bad experience with a processor `0`=No |
| `bad_experience_happened` | Required if bad_experience=1 | Description |

---

## Step 6 — Marketing & agreements (ApplicationStepRequest, step_count=6)

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/application/step`

### Key fields

| Field | Required | Notes |
|---|---|---|
| `uuid` | Yes | From Step 1 |
| `step_count` | Yes | Must be `6` |
| `howdidyouhear` | Yes | Slug from `/api/partner/referral-sources` |
| `hear_about_us_other` | Required if howdidyouhear contains `other`, `friend`, or `referral` | Text |
| `terms` | Yes | Must be `1` (agreed) |

On Step 6 success, EMAP finalises the application. Clear `localStorage` keys and show a success panel.

---

## Dropdown APIs (GET, no auth required, cache 1 hour)

| Endpoint | Used in | Returns |
|---|---|---|
| `GET /api/partner/countries` | Step 1, Step 2 (address), Step 4 (owner address) | `{ data: [ { id, name, code } ] }` |
| `GET /api/partner/states` | Step 1, Step 2, Step 4 | `{ data: [ { id, name, code } ] }` |
| `GET /api/partner/industry-types` | Step 2 | `{ data: [ { id, name, slug } ] }` |
| `GET /api/partner/shopping-carts` | Step 3 | `{ data: [ { id, name, slug } ] }` |
| `GET /api/partner/referral-sources` | Step 6 | `{ data: [ { id, name, slug } ] }` |
| `GET /api/partner/interest-details` | Step 3 | `{ data: [ { id, name, slug, group_name } ] }` |

Proxy all dropdown calls through your backend (same origin) to avoid CORS issues.

---

## Error handling

On any step, EMAP may return:

| Status | Body | Your action |
|---|---|---|
| 200 | `{"status":true, ...}` | Advance to next step |
| 422 | `{"status":false,"errors":{...}}` | Show per-field errors |
| 429 | — | Show "too many requests, try again" |
| 500+ | — | Show generic error; retry is safe |

See [`api-errors.md`](api-errors.md) for the complete table.

---

## UUID lifecycle

```
Step 1 success → uuid + country stored in localStorage('emap_uuid', 'emap_country')
Steps 2–6     → uuid read from localStorage, sent in every request
Step 6 success → localStorage keys cleared
```

`localStorage` is used (not `sessionStorage`) so the UUID survives accidental tab closes
and browser restarts. When the merchant reopens the page, the stored UUID is read back and
they can continue from where they left off without repeating Step 1.

**Never store sensitive fields (SSN, DOB, bank data) in localStorage.** Only the UUID
and 2-char country code are persisted — neither is sensitive.

---

## Security notes

- `partner_key` must be injected by the backend (from env). Never expose it to the browser.
- Never call `EMAP /api/v1/*` directly from browser-side JavaScript.
- Never store SSN, DOB, or bank account numbers after forwarding to EMAP.
- Never log request bodies on steps that contain SSN or bank data (steps 4 and 5).
- Set `Cache-Control: no-store` on all backend responses.
- See [`security-checklist.md`](security-checklist.md) before going live.
