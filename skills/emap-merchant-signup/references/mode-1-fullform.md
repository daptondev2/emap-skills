# Integration 1: Full Form — Deep Reference

Integration 1 hosts the complete EMAP 6-step merchant signup on the partner's site.
Each step is a separate API call POSTed directly from the browser to EMAP — pure
client-side, no backend of this form's own. The merchant never visits the EMAP domain
(until Step 6 redirects them to EMAP's document-upload page).

> **This file documents API payload rules, not UI widget types.** The tables below tell you
> what value to send and whether a field is required — they do not tell you whether to render a
> `<select>`, radio buttons, or a checkbox-group. For widget type, option labels, and per-country
> validation limits (`countryVariants`), always check `../signup-steps-schema.json` — do not infer
> the widget from the field's data type or name.
>
> **Known landmine fields** (previously generated wrong because their widget/validation isn't
> obvious from a value-format note alone):
> - `marketingModel` — schema `type: checkbox-group`, not a select of raw integers.
> - `is_physical_address_same_as_legal_address`, `primary_contact`, `bankruptcy_filed.1/.2`,
>   `bankruptcy_discharged.1/.2`, `current_processing`, `bad_experience`,
>   `multiple_merchant_accounts` — schema `type: radio` (Yes/No), not a select.
> - `routing_number` (US: exactly 9 digits), `account_number` (US: 8–17 chars) — the `countryVariants`
>   length limit must be enforced in code (HTML attribute + submit-time check), not just shown as a
>   hint string.
> - `dob.1`/`dob.2` — owner must be 18–100 years old. Enforce this client-side (date input
>   `min`/`max` + submit-time check). EMAP's API doesn't check it
>   ([api-quirks.md](api-quirks.md#owner-age-isnt-checked-by-the-api)).
>
> API rules that differ from EMAP's own signup page are collected in [`api-quirks.md`](api-quirks.md).

`{EMAP_BASE_URL}` is `https://emap.epd.dev`, EMAP's **test server**, during development. Switch to
the production URL Easy Pay Direct gives you before launch, and never create test applications on
production.

---

## Overview of EMAP endpoints used

Each step is called directly: `fetch(EMAP_BASE_URL + '<EMAP endpoint>', ...)` from the browser.

| Step | EMAP endpoint | Notes |
|---|---|---|
| 1 | `POST /api/v1/signup` | `step_count=1`; returns the `uuid` used by every later step |
| 2 | `POST /api/v1/application/step` | `step_count=2` |
| 3 | `POST /api/v1/application/step` | `step_count=3` |
| 4 | `POST /api/v1/ownership` | `step_count=4`; nested dot-notation fields (see Step 4 below) |
| 5 | `POST /api/v1/application/step` | `step_count=5` |
| 6 | `POST /api/v1/application/step` | `step_count=6` |

The `uuid` returned by Step 1 must be included in every subsequent request.

---

## Step 1 — Basic business info

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/signup`

### Request body

```json
{
  "step_count": 1,
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
| `step_count` | Yes | integer | Must be `1` |
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
| `partner_key` | No | string | from the `EMAP_PARTNER_KEY` constant in the script — see the Security notes below |

### Response

Same shapes as Integration 3. See [`api-errors.md`](api-errors.md) for the full table.

On success: `{ "status": true, "uuid": "<uuid>" }`. Store the `uuid` and `country` in `localStorage` as `emap_uuid` and `emap_country` (see [UUID lifecycle](#uuid-lifecycle)). The persisted `emap_country` code drives conditional field visibility in steps 2 and 5 — do not use the address country fields for this purpose.

For an existing user (`verificationLink: true`), tell the merchant to check their email. Don't link to the returned `url`: the email is what proves they own the address.

---

## Step 2 — Business details (step_count=2)

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
| `federal_tax_id` | Required unless Step 1 country=`CA` or `business_organized`=`Sole-Proprietorship` ([note](api-quirks.md#federal_tax_id-canada-and-sole-proprietorship-are-exempt)). | Numeric only, masked `XXX-XX-XXXX` (3-2-4) for US/CA/PR, `XX-XXXXXXX` (2-7) otherwise — never free-form alphanumeric, in any country. Use `country_from_step1` (the Step 1 formation country), not `address_country`. |
| `business_register_number` | Required for every Step 1 country except `US`. Don't also exempt PR or CA sole-props ([why](api-quirks.md#business_register_number-only-the-us-is-exempt)). | Max 20 (11 for CA). Use `country_from_step1` (the Step 1 formation country), not `address_country`. |
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
| `subscription_frequency` | Required if `marketingModel` includes `2` | `1`=Monthly `2`=Yearly `3`=Other (`staticDropdowns.subscription_frequency` in the schema) |
| `subscription_frequency_other` | Required if subscription_frequency=`3` | Min 5, max 255 |

---

## Step 3 — Processing info (step_count=3)

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

## Step 4 — Ownership info

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/ownership`

Fields use dot-notation names (e.g. `first_name.1`, `ssn.1`). The number suffix is the owner index.
Owner 2 is required when `ownership_percentage.1 < 51`.

### Common fields

| Field | Required | Notes |
|---|---|---|
| `uuid` | Yes | From Step 1 |
| `step_count` | Yes | Must be `4` |
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
| `ssn.1` | Yes | US/CA/PR: `XXX-XX-XXXX` (Cleave blocks `[3,2,4]`); every other country: plain, unmasked tax ID. **Keyed off `country_from_step1` (the Step 1 formation country) — the SAME value drives `ssn.2` — not `country.1`** (see note below). |
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

**`ssn.2` uses the exact same `country_from_step1`-driven format/mask as `ssn.1`** (see its row
above) — both owners share the one Step 1 formation country. `country.2` (Owner 2's own home
address country) only gates `driver_license_state.2`/`driver_license_expiration_date.2`; it has no
effect on SSN formatting.

**SSN/DOB/bank data: never store or log these values. Send over HTTPS only.**

---

## Step 5 — Bank info (step_count=5)

**EMAP endpoint:** `POST {EMAP_BASE_URL}/api/v1/application/step`

### Key fields

| Field | Required | Notes |
|---|---|---|
| `uuid` | Yes | From Step 1 |
| `step_count` | Yes | Must be `5` |
| `current_processing` | Yes | Boolean |
| `routing_number` | Yes | Alphanumeric, max 20 generically. **US: must be exactly 9 digits** — enforce with `pattern="^[0-9]{9}$"` and a submit-time length check, not just a hint label. See `countryVariants` in `signup-steps-schema.json`. |
| `account_number` | Yes | Alphanumeric, max 20 generically. **US: must be 8–17 characters** — enforce, don't just hint. See `countryVariants` in `signup-steps-schema.json`. |
| `institution_number` | Show/required when Step 1 country=`CA` | 3-digit Canadian institution number; format `[0-9]{3}`. Use `emap_country` from localStorage. |
| `customer_pay_currency` | Show/required when Step 1 country=`CA` | `USD` or `CAD`. Use `emap_country` from localStorage. |

---

## Step 6 — Referral & agreements (step_count=6)

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

On Step 6 success, EMAP finalises the application. Clear all saved-progress `localStorage` keys and navigate the top window to `{EMAP_BASE_URL}/upload-document/{uuid}?redirect=1`, where the merchant uploads their documents on EMAP.

---

## Dropdown APIs (GET, no auth required, cache 1 hour)

| Endpoint | Used in | Returns |
|---|---|---|
| `GET /api/partner/countries` | Step 1, Step 2 (address), Step 4 (owner address) | `{ data: [ { name, code } ] }` |
| `GET /api/partner/states` | Step 1, Step 2, Step 4 | `{ data: [ { name, code } ] }` |
| `GET /api/partner/industry-types` | Step 1 | `{ data: [ { name, slug } ] }` |
| `GET /api/partner/interest-details` | Step 6 (`other_interests_capital`) | `{ data: [ { group_name, interests: [ { id, name } ] } ] }` — send the interest `id`s |
| `GET /api/partner/shopping-carts` | Step 3 | `{ data: [ { name, slug } ] }` |
| `GET /api/partner/referral-sources` | Step 6 | `{ data: [ { name, slug } ] }` (no `id`) |

The live endpoints may return extra keys (such as `id`); the template uses only the ones listed,
which are also the only ones in the fallback data. Drop rows whose `code` (countries, states) or
`slug` (the others) is empty; `usableRows()` in the template does this.

Call each of these directly from the browser (`fetch(EMAP_BASE_URL + '<path>')`). EMAP's API allows
these cross-origin calls via CORS, so no backend proxy is needed or used. If EMAP limits CORS to
registered partner sites, the partner's origin must be registered with Easy Pay Direct.

**Fallback on failure:** if the live call to any of these six endpoints errors, times out, or
returns an empty/missing `data` array, the client must fall back to the matching entry in the
embedded `EMAP_DROPDOWN_FALLBACKS` constant (sourced from
[`dropdown-fallbacks.json`](dropdown-fallbacks.json)) instead of an empty result — see
`fetchDropdownData()` in `templates/integration-1/plain-html.html` for the reference pattern. Never
let a dropdown-API hiccup render an empty `<select>`.

---

## Error handling

On any step, EMAP may return:

| Status | Body | Your action |
|---|---|---|
| 200 | `{"status":true, ...}` | Advance to next step |
| 200 | `{"status":false, ...}` | Stay on the step; show a generic error |
| 422 | `{"status":false,"errors":{...}}` | Show per-field errors |
| 429 | — | Show "too many requests, try again" |
| 500+ | — | Show generic error; the merchant can retry the same step |

See [`api-errors.md`](api-errors.md) for the complete table.

---

## UUID lifecycle

```
Step 1 success → emap_uuid, emap_country saved to localStorage
Each step      → emap_step saved; the step 2 marketing-model choice → emap_marketing_model
Steps 2–6      → uuid read from localStorage, sent in every request
Step 6 success → all four keys cleared
```

The template saves exactly these four keys (`SAVED_PROGRESS_KEYS`): `emap_uuid`, `emap_country`,
`emap_step` and `emap_marketing_model`. `localStorage` is used (not `sessionStorage`) so progress
survives accidental tab closes and browser restarts. When the merchant reopens the page, the form
resumes at the saved step without repeating Step 1.

**The `uuid` is sensitive.** Anyone holding it can continue that application, so treat it like a
password: never display it, log it, or send it to analytics or an error tracker. Because it stays
in `localStorage`, the next person on a shared computer would land inside the previous merchant's
application. The template handles this with a resume notice, "You're continuing a saved
application. Not you? Start a new application", which clears all four keys.

**Never store other sensitive fields (SSN, DOB, bank data) in localStorage.**

---

## Security notes

- `partner_key` is set as a constant directly in the client file and is therefore visible in the
  deployed page's source — an accepted tradeoff of this pure-client architecture (see SKILL.md
  Step 2), not something to hide behind a backend that doesn't exist here.
- Never store SSN, DOB, or bank account numbers anywhere yourself after sending them to EMAP —
  there is no backend or database of this form's own to store them in.
- Never `console.log` request bodies on steps that contain SSN or bank data (steps 4 and 5), and
  never log the `uuid`.
- See [`security-checklist.md`](security-checklist.md) before going live.
