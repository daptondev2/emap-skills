# Step-1 Field Catalog

Complete field reference for both integration modes.

> **Note on company name field naming:** The two modes use different field names for the company name.
> Integration 2 URL param is `company_name`; Integration 3 API field is `name`. This is intentional —
> the EMAP web form uses `name`, but the `from_lander` auto-save logic checks `company_name` in URL params.

---

## Core fields

| Field | Int 2 URL param | Int 3 API field | Required | Validation rules | Notes |
|---|---|---|---|---|---|
| First Name | `first_name` | `first_name` | Required | string, max 60 chars, letters/spaces/hyphens/apostrophes | |
| Last Name | `last_name` | `last_name` | Required | string, max 60 chars, letters/spaces/hyphens/apostrophes | |
| Email | `email` | `email` | Required | RFC-5322 format; regex `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$` | Int 3: must be unique in EMAP. Existing user returns `verificationLink`. |
| Phone | `phone` | `phone` | Required | max 20 chars; digits, `+`, `-`, `(`, `)`, spaces only; regex `^[0-9+\-()\s]+$` | E.164 strongly recommended: `+12025551234`. EMAP's own validation uses this same regex. |
| Company Name | `company_name` | `name` | Required | string, max 60 chars | **Different param name in each mode.** |
| Website | `website` | `website` | Required | Must be a valid URL; optional `http://` or `https://` prefix; regex `^(https?:\/\/)?[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}(\/[^\s]*)?$` | EMAP uses this for fraud screening. |
| Country | `country` | `country` | Required | 2-char ISO 3166-1 alpha-2 code, e.g. `US`, `CA`, `GB` | Int 2: EMAP also resolves full country names. Int 3: strict code match required. |
| Annual Sales | `annual_sales` | `annual_sales` | Required | integer, min 1, max 999,999,999,999 | In USD. |
| Business State | `business_state` | `business_state` | Conditional | 2-char US state code; must be a valid state from the list below | Required when `country=US`. Excluded from auto-submit check in Int 2. |
| Promo Code | `promo_code` | `promo_code` | Optional | string, max 255 chars | Referral/promo code. Excluded from auto-submit check in Int 2. |

**Valid US state codes:** AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA,
ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN,
TX, UT, VT, VA, WA, WV, WI, WY, DC

---

## Integration 2 auto-submit fields

These fields are checked by `SignupController::index()` to decide whether to set `$auto_submit=true`.
If **any** of them is missing (null/empty), the auto-submit JS does not fire and the merchant sees
the form pre-filled but must submit manually.

| Field | Int 2 URL param | Validation rules | Notes |
|---|---|---|---|
| Highest Transaction Amount | `highest_transaction_amount` | Positive number, max 16 chars | Max single-transaction amount in USD |
| Industry Type | `industry_type` | Non-empty string | Name or slug; EMAP resolves to an ID server-side |
| Marketing Model | `marketing_model[]` | Array of integers; valid values: `1`, `2`, `3` | Repeat the param: `marketing_model[]=1&marketing_model[]=2`. 1=E-Commerce, 2=Recurring/Subscription, 3=Retail |
| Card Swiped % | `card_swiped` | Integer 0–100 | **Cross-field rule:** `card_swiped + customer_entered + staff_entered` must equal exactly 100 |
| Customer Entered % | `customer_entered` | Integer 0–100 | Card-not-present; customer types in the card number |
| Staff Entered % | `staff_entered` | Integer 0–100 | Card-not-present; staff types in the card number |
| Currently Processing | `current_processing` | Must be `0` or `1` | Whether the merchant currently accepts card payments |
| Expected Monthly Volume | `expected_monthly_volume` | Positive integer | Expected monthly card-processing volume in USD |

> **From-lander auto-save (partial):** Even without these extra fields, when `first_name`,
> `last_name`, `company_name`, `phone`, and `email` are all present, EMAP sets `from_lander=1`
> and auto-saves the partial record in the background. The merchant still sees the form but
> their basic info is already saved in EMAP.

---

## Integration 2 attribution and tracking fields

| Field | Int 2 URL param | Notes |
|---|---|---|
| Partner Attribution | `secretKey` | The partner's `security_key` from EMAP. Add server-side from `EMAP_PARTNER_SECRET_KEY` env. |
| UTM Campaign | `utm_campaign` | Pass through from current page URL |
| UTM Source | `utm_source` | Pass through from current page URL |
| UTM Medium | `utm_medium` | Pass through from current page URL |
| UTM Term | `utm_term` | Pass through from current page URL |
| UTM Content | `utm_content` | Pass through from current page URL |
| Google Click ID | `gclid` | Pass through from current page URL |
| Google Broad match Click ID | `gbraid` | Pass through from current page URL |
| Bing Click ID | `wbraid` | Pass through from current page URL |

---

## Integration 3 attribution fields (backend only)

| Field | Int 3 API field | Notes |
|---|---|---|
| Partner Key | `partner_key` | The partner's `security_key`. Read from `EMAP_PARTNER_KEY` env. **Never from request body.** |
| Partner ID | `partner_id` | The partner's user ID in EMAP. Alternative to `partner_key`. |

---

## Excluded fields (not in step-1 form)

These fields are collected in later steps on EMAP and should never appear in the step-1 form:

| Field | Reason |
|---|---|
| SSN / Government ID | Sensitive — collected in step 4 (owners) on EMAP |
| Date of Birth | Sensitive — collected in step 4 on EMAP |
| Bank account / routing number | Sensitive — collected in step 5 (banking) on EMAP |
| Driver's license | Sensitive — collected in step 4 on EMAP |
| Legal business address | Collected in step 2 on EMAP |
| Federal Tax ID (EIN) | Collected in step 2 on EMAP |
| Document uploads | Collected in step 6 on EMAP; never in partner forms |
| HelloSign e-signature | Step 7 on EMAP |
