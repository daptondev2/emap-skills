# Step-1 Field Catalog

Complete field reference for Integration 2 (redirect) and Integration 3 (email-based signup).
Limits and patterns come from [`../signup-steps-schema.json`](../signup-steps-schema.json); if
this table and the schema disagree, the schema wins.

> **Not for Integration 1.** The country/industry_type value formats and required-ness rules
> below are specific to Int 2/3. For Integration 1, use
> [`mode-1-fullform.md`](mode-1-fullform.md) and `../signup-steps-schema.json` instead — do not
> pull field formats from this file when building Integration 1.

> **Company name field naming difference:** Integration 2 URL param is `company_name`;
> Integration 3 API field is `name`. This is intentional: the API uses `name`, but EMAP's
> `/signup` page reads `company_name` from the URL (and needs it for auto-submit).

---

## Core fields

| Field | Int 2 URL param | Int 3 API field | Required | Validation rules | Notes |
|---|---|---|---|---|---|
| First Name | `first_name` | `first_name` | Required | string, max 255 chars | |
| Last Name | `last_name` | `last_name` | Required | string, max 255 chars | |
| Email | `email` | `email` | Required | RFC-5322 format; `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$` | Int 3: existing email returns `verificationLink` response |
| Phone | `phone` | `phone` | Required | max 20 chars; digits, `+`, `-`, `(`, `)`, spaces; `^[0-9+\-()\s]+$` | E.164 recommended: `+12025551234`. The templates use intl-tel-input (country picker, as-you-type formatting, `isValidNumber()` check) and send `getNumber()`, which is E.164. |
| Company Name | `company_name` | `name` | Required | string, max 255 chars | **Different param name per mode — see note above** |
| Website | `website` | `website` | Required | Domain with an optional `http(s)://` prefix; use the `pattern` on `website` in the schema | EMAP's `/signup` page also checks it before auto-submitting (Int 2) |
| Country | `country` | `country` | Required | **Int 2:** full country name, e.g. `United States`, `Canada` — use the `name` field from `/api/partner/countries` (the schema's `integration2UrlValue`). **Int 3:** 2-char ISO code, e.g. `US`, `CA` | Value format differs between modes |
| Annual Sales | `annual_sales` | `annual_sales` | Required | integer, min 1, max 999,999,999,999 | In USD |
| Business State | `business_state` | `business_state` | When US | 2-char US state code (see list below) | Required when country = United States (Int 2) or `US` (Int 3) |
| Industry Type | `industry_type` | `industry_type` | Required | **Int 2:** full industry name, e.g. `E-Commerce` — use the `name` field from `/api/partner/industry-types` (the schema's `integration2UrlValue`). **Int 3:** slug, e.g. `e-commerce` — use the `slug` field | Value format differs between modes |
| Industry Type Other | `industry_type_other` | `industry_type_other` | Conditional | string, max 255 chars | Required when the selected industry's slug is `other`, compared case-insensitively (EMAP returns `Other`). Int 2 keeps the slug in `data-slug` for this check |
| Promo Code | `promo_code` | `promo_code` | Optional | string, max 255 chars | Referral / promo code |

**Valid US state codes:** AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA,
ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN,
TX, UT, VT, VA, WA, WV, WI, WY, DC

---

## Integration 2 — auto-submit

When these 5 params are all present in the redirect URL, EMAP's `/signup` page validates the
prefilled form and, if it passes, submits it for the merchant, who lands on step 2:

`first_name`, `last_name`, `company_name`, `phone`, `email`

If one is missing, or EMAP's page rejects a value (company name, first and last name, website,
email or annual sales), the merchant sees the prefilled form and submits it. Every other field
above pre-fills the form. Observed on EMAP's test server; see
[`mode-2-redirect.md`](mode-2-redirect.md#how-it-works).

---

## Integration 2 attribution and tracking fields

| Field | URL param | Notes |
|---|---|---|
| Partner Attribution | `secretKey` | The partner key (EMAP's URL param has this name, but the value isn't a secret). Set as the `EMAP_PARTNER_KEY` constant directly in the template's `<script>` block — visible client-side by design, see SKILL.md Step 2 |
| UTM Campaign | `utm_campaign` | Pass through from current page URL |
| UTM Source | `utm_source` | Pass through from current page URL |
| UTM Medium | `utm_medium` | Pass through from current page URL |
| UTM Term | `utm_term` | Pass through from current page URL |
| UTM Content | `utm_content` | Pass through from current page URL |
| Google Click ID | `gclid` | Pass through from current page URL |
| Google Ads click ID (app, iOS) | `gbraid` | Pass through from current page URL |
| Google Ads click ID (web, iOS) | `wbraid` | Pass through from current page URL |

---

## Integration 3 attribution fields

| Field | API field | Notes |
|---|---|---|
| Partner Key | `partner_key` | The partner key from the partner portal. Set as the `EMAP_PARTNER_KEY` constant directly in the template's `<script>` block — visible client-side by design, see SKILL.md Step 2. Not a form input the merchant fills in. |

---

## Excluded fields (not in step-1 form)

These fields are collected in later steps on EMAP and must never appear in an Integration 2 or 3
form. (Integration 1 collects steps 2–6 itself; see [`mode-1-fullform.md`](mode-1-fullform.md).)
Document uploads and the e-signature are never in any partner form:

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
| Document uploads | Collected on EMAP after step 6; never in partner forms |
| E-signature | Collected on EMAP after step 6; never in partner forms |
