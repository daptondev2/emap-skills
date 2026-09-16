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
  "industry_type": "e-commerce",
  "industry_type_other": "",
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
| `industry_type` | Yes | string | Slug from `/api/partner/industry-types` — collected in Step 1, sent with signup |
| `industry_type_other` | Required if industry_type=`other` | string | Max 255 |
| `promo_code` | No | string | max 255 |
| `partner_key` | No | string | inject from env; never from browser |

### Response

Same shapes as Integration 3. See [`api-errors.md`](api-errors.md) for the full table.

On success: `{ "status": true, "uuid": "<uuid>" }`. Store the `uuid` and `country` in `localStorage` as `emap_uuid` and `emap_country`. The persisted `emap_country` code drives conditional field visibility in steps 2 and 5 — do not use the address country fields for this purpose.

---

## Step 2 — Business details (ApplicationStepRequest, step_count=2)

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/application/step`

### Key fields

| Field | Required | Notes |
|---|---|---|
| `uuid` | Yes | From Step 1 |
| `step_count` | Yes | Must be `2` |
| `legal_name` | Yes | Legal company name, max 255 — pre-fill from Step 1 `name` |
| `name` | Yes | Trading/DBA name, max 255 — pre-fill from Step 1 `name` |
| `customer_service_telephone_number` | Yes | Max 20; digits, `+`, `-`, `(`, `)`, spaces |
| `business_organized` | Yes | One of: `Corporation`, `LLC`, `Partnership`, `Government`, `Sole-Proprietorship`, `Non-Profit`, `Other` |
| `business_location` | Yes | One of: `Home-Based`, `Co-Working`, `Corporate-Office`, `Storefront`, `Others` |
| `business_formed` | Yes | Business formation date, format `YYYY-MM-DD` |
| `federal_tax_id` | Required unless Step 1 country=`CA` or business_organized=`sole-proprietorship` | Max 20; alphanumeric and hyphens. Use `emap_country` from localStorage, not `address_country`. |
| `business_register_number` | Required when Step 1 country ≠ `US` | Max 20. Use `emap_country` from localStorage, not `address_country`. |
| `street_number` | Yes | Max 10 |
| `street_address` | Yes | Max 255 |
| `city` | Yes | Max 100 |
| `state` | Yes | State/province |
| `postal_code` | Yes | Max 20 |
| `address_country` | Yes | 2-char ISO country code |
| `is_physical_address_same_as_legal_address` | Yes | `1` = same, `0` = different |
| `physical_address_street_number` | Required if is_physical_address_same_as_legal_address=`0` | Max 10 |
| `physical_address_street_address` | Required if is_physical_address_same_as_legal_address=`0` | Max 255 |
| `physical_address_city` | Required if is_physical_address_same_as_legal_address=`0` | Max 100 |
| `physical_address_state` | Required if is_physical_address_same_as_legal_address=`0` | State/province |
| `physical_address_postal_code` | Required if is_physical_address_same_as_legal_address=`0` | Max 20 |
| `physical_address_country` | Required if is_physical_address_same_as_legal_address=`0` | 2-char ISO |
| `marketingModel` | Yes | Array of integer IDs — hardcoded: `1`=One Time Purchase, `2`=Recurring/Continuity/Subscription, `3`=Trial Offer + Subscription |
| `subscription_frequency` | Required if `marketingModel` includes `2` | `1`=Weekly `2`=Monthly `3`=Other |
| `subscription_frequency_other` | Required if subscription_frequency=`3` | Min 5, max 255 |

---

## Step 3 — Processing info (ApplicationStepRequest, step_count=3)

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/application/step`

### Key fields

| Field | Required | Notes |
|---|---|---|
| `uuid` | Yes | From Step 1 |
| `step_count` | Yes | Must be `3` |
| `card_swiped` | Yes | Numeric 0–100; must be a multiple of 5 |
| `customer_entered` | Yes | Numeric 0–100; must be a multiple of 5 |
| `staff_entered` | Yes | Numeric 0–100; must be a multiple of 5 |
| `fulfillment_by` | Yes | One of: `Direct-By-You`, `Vendor`, `Others` |
| `fullfillment_company` | Required if fulfillment_by=`Vendor` or `Others` | Max 300 (note: two l's) |
| `average_transaction_amount` | Yes | Numeric, min 1 |
| `highest_transaction_amount` | Yes | Numeric, min 1 |
| `shopping_cart` | Yes | Slug from `/api/partner/shopping-carts` (dynamic; load from API) |
| `refund_policy` | Yes | One of: `Full-Refund`, `No-Refund`, `Exchange-Only`, `Partial-Refund` |
| `customer_service_time` | Yes | One of: `0-7-days`, `7-30-days`, `31+days` |

**Card percentage rule:** `card_swiped + customer_entered + staff_entered` must equal exactly 100. Each value must be a multiple of 5.

---

## Step 4 — Ownership info (HandleOwnershipRequest)

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/ownership`

Fields use dot-notation names (e.g. `first_name.1`, `ssn.1`). The number suffix is the owner index.
Owner 2 is required when `ownership_percentage.1 < 51`.

### Common fields

| Field | Required | Notes |
|---|---|---|
| `uuid` | Yes | From Step 1 |
| `primary_contact` | Yes | `1` = the person filling the form IS the owner; `0` = someone else is filling it on behalf of the owner |
| `primary_contact_job_title` | Required if primary_contact=`0` | Max 255 |

### Owner 1 fields

| Field | Required | Notes |
|---|---|---|
| `first_name.1` | Required if primary_contact=`0` | Max 60; omit when primary_contact=1 (backend uses Step 1 data) |
| `last_name.1` | Required if primary_contact=`0` | Max 60 |
| `email.1` | Required if primary_contact=`0` | Valid email |
| `phone.1` | Yes | Phone number |
| `title.1` | Yes | Slug from owner job title list |
| `ownership_percentage.1` | Yes | Integer 1–100 |
| `dob.1` | Yes | Format `YYYY-MM-DD`; owner must be 18–100 years old |
| `ssn.1` | Yes | US/CA: `XXX-XX-XXXX`; other countries: plain tax ID |
| `street_number.1` | Yes | Max 10 |
| `street_address.1` | Yes | Max 255 |
| `city.1` | Yes | Max 100 |
| `state.1` | Yes | State/province |
| `postal_code.1` | Yes | Max 20 |
| `country.1` | Yes | 2-char ISO code |
| `license.1` | Yes | Driver license number; min 5, max 25 |
| `driver_license_state.1` | Required if country.1=`US` | 2-char state code |
| `driver_license_expiration_date.1` | Required if country.1=`US` | Format `YYYY-MM-DD`; must be a future date |
| `bankruptcy_filed.1` | Yes | `1`=Yes `0`=No |
| `bankruptcy_discharged.1` | Required if bankruptcy_filed.1=`1` | `1`=Yes `0`=No |
| `bankruptcy_discharged_date.1` | Required if bankruptcy_discharged.1=`1` | Format `YYYY-MM-DD`; must be a past date |

### Owner 2 fields (required when ownership_percentage.1 < 51)

All Owner 2 fields use the `.2` suffix. Required fields mirror Owner 1:
`first_name.2`, `last_name.2`, `email.2`, `phone.2`, `title.2`, `ssn.2`, `dob.2`, `ownership_percentage.2`,
`street_number.2`, `street_address.2`, `city.2`, `state.2`, `postal_code.2`, `country.2`,
`license.2`, `driver_license_state.2` (if country.2=US), `driver_license_expiration_date.2` (if country.2=US),
`bankruptcy_filed.2`, `bankruptcy_discharged.2` (if filed), `bankruptcy_discharged_date.2` (if discharged).

**Combined ownership** (`ownership_percentage.1 + ownership_percentage.2`) must not exceed 100.

**SSN/DOB/bank data: never store or log these values. Send over HTTPS only.**

---

## Step 5 — Bank info (ApplicationStepRequest, step_count=5)

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/application/step`

### Key fields

| Field | Required | Notes |
|---|---|---|
| `uuid` | Yes | From Step 1 |
| `step_count` | Yes | Must be `5` |
| `current_processing` | Yes | Boolean |
| `routing_number` | Yes | Alphanumeric, max 20 |
| `account_number` | Yes | Alphanumeric, max 20 |
| `institution_number` | Show/required when Step 1 country=`CA` | 3-digit Canadian institution number; format `[0-9]{3}`. Use `emap_country` from localStorage. |
| `customer_pay_currency` | Show/required when Step 1 country=`CA` | `USD` or `CAD`. Use `emap_country` from localStorage. |

---

## Step 6 — Referral & agreements (ApplicationStepRequest, step_count=6)

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/application/step`

### Key fields

| Field | Required | Notes |
|---|---|---|
| `uuid` | Yes | From Step 1 |
| `step_count` | Yes | Must be `6` |
| `howdidyouhear` | Yes | Slug from `/api/partner/referral-sources` |
| `hear_about_us_other` | No | Max 255 |
| `multiple_merchant_accounts` | Yes | Boolean |
| `transaction_device` | No | Slug from transaction devices |
| `bad_experience` | Yes | Boolean |
| `bad_experience_happened` | Required if bad_experience=`true` | Max 500 |
| `other_interests_capital` | No | Array of integer IDs — load options dynamically from `GET /api/partner/interest-details`; response is grouped by `group_name` |
| `terms_and_conditions_agreed` | Yes | Boolean |

On Step 6 success, EMAP finalises the application. Clear `localStorage` keys and show a success panel.

---

## Dropdown APIs (GET, no auth required, cache 1 hour)

| Endpoint | Used in | Returns |
|---|---|---|
| `GET /api/partner/countries` | Step 1, Step 2 (address), Step 4 (owner address) | `{ data: [ { id, name, code } ] }` |
| `GET /api/partner/states` | Step 1, Step 2, Step 4 | `{ data: [ { id, name, code } ] }` |
| `GET /api/partner/industry-types` | Step 1 | `{ data: [ { id, name, slug } ] }` |
| `GET /api/partner/interest-details` | Step 6 (`other_interests_capital`) | `{ data: [ { id, name, slug, group_name } ] }` |
| `GET /api/partner/shopping-carts` | Step 3 | `{ data: [ { id, name, slug } ] }` |
| `GET /api/partner/referral-sources` | Step 6 | `{ data: [ { id, name, slug } ] }` |

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
