# Step-1 Field Catalog

Complete field reference for both integration modes.

> **Note on company name field naming:** The two modes use different field names for the company name.
> Integration 2 URL param is `company_name`; Integration 3 API field is `name`. This is intentional —
> the EMAP web form uses `name`, but the `from_lander` auto-save logic checks `company_name` in URL params.

---

## Core fields

| Field | Int 2 URL param | Int 3 API field | Required | Type & constraints | Notes |
|---|---|---|---|---|---|
| First Name | `first_name` | `first_name` | Required | string, max 255 | |
| Last Name | `last_name` | `last_name` | Required | string, max 255 | |
| Email | `email` | `email` | Required | string, valid RFC email | Int 3: must be unique in EMAP. Existing user returns `verificationLink`. |
| Phone | `phone` | `phone` | Required | string, max 20; digits, `+`, `-`, `(`, `)`, spaces | E.164 recommended: `+12025551234` |
| Company Name | `company_name` | `name` | Required | string, max 255 | **Different param name in each mode** |
| Website | `website` | `website` | Required | string, valid URL | EMAP uses this for fraud screening and N8N website analysis |
| Country | `country` | `country` | Required | string | Int 2: country name or code (resolved by EMAP). Int 3: 2-char ISO code, e.g. `US`, `CA` |
| Annual Sales | `annual_sales` | `annual_sales` | Required | integer, min 1 | In USD. Int 3 max: 999,999,999,999 |
| Business State | `business_state` | `business_state` | Conditional | string, 2-char state code | Required when `country=US`. E.g. `CA`, `TX`, `NY`. Excluded from auto-submit check in Int 2. |
| Promo Code | `promo_code` | `promo_code` | Optional | string, max 255 | Referral/promo code. Excluded from auto-submit check in Int 2. |

---

## Integration 2 auto-submit fields

These fields are checked by `SignupController::index()` to decide whether to set `$auto_submit=true`.
If **any** of them is missing (null/empty), the auto-submit JS does not fire and the merchant sees
the form pre-filled but must submit manually.

| Field | Int 2 URL param | Notes |
|---|---|---|
| Highest Transaction Amount | `highest_transaction_amount` | Max single transaction in USD |
| Industry Type | `industry_type` | Industry type name or slug; EMAP resolves to an ID |
| Marketing Model | `marketing_model[]` | Repeat the param for multiple values: `marketing_model[]=1&marketing_model[]=2`. Values: 1=E-Commerce, 2=Recurring/Subscription, 3=Retail |
| Card Swiped % | `card_swiped` | Integer 0–100. `card_swiped + customer_entered + staff_entered` must equal 100 |
| Customer Entered % | `customer_entered` | Integer 0–100 |
| Staff Entered % | `staff_entered` | Integer 0–100 |
| Currently Processing | `current_processing` | `0` or `1`. Whether merchant currently accepts card payments |
| Expected Monthly Volume | `expected_monthly_volume` | Expected monthly card volume in USD |

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
| Persona ID verification | Step 4 on EMAP |
| Plaid bank linking | Step 5 on EMAP |
