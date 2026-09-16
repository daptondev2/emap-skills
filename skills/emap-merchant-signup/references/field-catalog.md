# Step-1 Field Catalog

Complete field reference for Integration 2 (redirect) and Integration 3 (API submission).

> **Not for Integration 1.** The country/industry_type value formats and required-ness rules
> below are specific to Int 2/3. For Integration 1, use
> [`mode-1-fullform.md`](mode-1-fullform.md) and `../signup-steps-schema.json` instead — do not
> pull field formats from this file when building Integration 1.

> **Company name field naming difference:** Integration 2 URL param is `company_name`;
> Integration 3 API field is `name`. This is intentional — EMAP's web form uses `name`,
> but the `from_lander` auto-save logic checks `company_name` in URL params.

---

## Core fields

| Field | Int 2 URL param | Int 3 API field | Required | Validation rules | Notes |
|---|---|---|---|---|---|
| First Name | `first_name` | `first_name` | Required | string, max 60 chars | |
| Last Name | `last_name` | `last_name` | Required | string, max 60 chars | |
| Email | `email` | `email` | Required | RFC-5322 format; `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$` | Int 3: existing email returns `verificationLink` response |
| Phone | `phone` | `phone` | Required | max 20 chars; digits, `+`, `-`, `(`, `)`, spaces; `^[0-9+\-()\s]+$` | E.164 recommended: `+12025551234` |
| Company Name | `company_name` | `name` | Required | string, max 60 chars | **Different param name per mode — see note above** |
| Website | `website` | `website` | Required | Valid URL; optional `https://` prefix; `^(https?:\/\/)?[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}(\/[^\s]*)?$` | |
| Country | `country` | `country` | Required | **Int 2:** full country name, e.g. `United States`, `Canada` — use the `name` field from `/api/partner/countries`. **Int 3:** 2-char ISO code, e.g. `US`, `CA` | Value format differs between modes |
| Annual Sales | `annual_sales` | `annual_sales` | Required | integer, min 1, max 999,999,999,999 | In USD |
| Business State | `business_state` | `business_state` | When US | 2-char US state code (see list below) | Required when country = United States (Int 2) or `US` (Int 3) |
| Industry Type | `industry_type` | `industry_type` | Required | **Int 1:** slug, e.g. `e-commerce` — use the `slug` field from `/api/partner/industry-types`. **Int 2:** full industry name, e.g. `E-Commerce` — use the `name` field. **Int 3:** slug, e.g. `e-commerce` — use the `slug` field | Value format differs between modes |
| Industry Type Other | `industry_type_other` | `industry_type_other` | Conditional | string, max 255 chars | Required when `industry_type` = "Other" (Int 2) or `other` (Int 3) |
| Promo Code | `promo_code` | `promo_code` | Optional | string, max 255 chars | Referral / promo code |

**Valid US state codes:** AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA,
ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN,
TX, UT, VT, VA, WA, WV, WI, WY, DC

---

## Integration 2 — from-lander auto-save

When these 5 fields are ALL present in the redirect URL, EMAP sets `from_lander=1` and
auto-saves the partial record in the background. The merchant still sees the prefilled form
and must submit it manually. All other fields above are optional but will pre-fill the form.

Required for auto-save: `first_name`, `last_name`, `company_name`, `phone`, `email`

---

## Integration 2 attribution and tracking fields

| Field | URL param | Notes |
|---|---|---|
| Partner Attribution | `secretKey` | Partner's `security_key` from EMAP. Append server-side from `EMAP_PARTNER_SECRET_KEY` env — never hardcode in JS |
| UTM Campaign | `utm_campaign` | Pass through from current page URL |
| UTM Source | `utm_source` | Pass through from current page URL |
| UTM Medium | `utm_medium` | Pass through from current page URL |
| UTM Term | `utm_term` | Pass through from current page URL |
| UTM Content | `utm_content` | Pass through from current page URL |
| Google Click ID | `gclid` | Pass through from current page URL |
| Google Broad match | `gbraid` | Pass through from current page URL |
| Bing Click ID | `wbraid` | Pass through from current page URL |

---

## Integration 3 attribution fields (backend only)

| Field | API field | Notes |
|---|---|---|
| Partner Key | `partner_key` | Partner's `security_key`. Read from `EMAP_PARTNER_KEY` env. **Never from request body.** |
| Partner ID | `partner_id` | Partner's user ID in EMAP. Alternative to `partner_key` |

---

## Excluded fields (not in step-1 form)

These fields are collected in later steps on EMAP and must never appear in a partner-hosted form:

| Field | Reason |
|---|---|
| SSN / Government ID | Sensitive — collected in step 4 (owners) on EMAP |
| Date of Birth | Sensitive — collected in step 4 on EMAP |
| Bank account / routing number | Sensitive — collected in step 5 (banking) on EMAP |
| Driver's licence | Sensitive — collected in step 4 on EMAP |
| Legal business address | Collected in step 2 on EMAP |
| Federal Tax ID (EIN) | Collected in step 2 on EMAP |
| Marketing Model | Collected in step 2 on EMAP |
| Card Processing Split (card_swiped / customer_entered / staff_entered) | Collected in step 3 on EMAP |
| Highest Transaction Amount | Collected in step 3 on EMAP |
| Currently Processing Card Payments | Collected in step 5 on EMAP |
| Expected Monthly Volume | Collected in step 3 on EMAP |
| Document uploads | Collected in step 6 on EMAP; never in partner forms |
| HelloSign e-signature | Step 7 on EMAP |
