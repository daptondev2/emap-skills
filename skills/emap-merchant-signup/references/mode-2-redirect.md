# Integration 2: Redirect Handoff — Deep Reference

## What Integration 2 is

Integration 2 is a **single-step form** on the partner's site that collects the same basic
merchant info as Integration 1 Step 1 (name, email, phone, company, website, country, sales, etc.).
**There is no Terms and Conditions checkbox** — the merchant agrees to terms on EMAP after step 6.

On submit, all collected fields are serialized as URL query parameters and the browser redirects
to `{EMAP_BASE_URL}/signup?{params}`. EMAP reads the params, prefills its own step-1 form, and
shows it to the merchant, who fills in any remaining fields and submits.

All remaining steps (company info, banking, e-signature) happen on EMAP.

---

## Form fields

These are the only fields collected in an Integration 2 form — the same set as Integration 1 Step 1:

| Field | Required | Notes |
|---|---|---|
| `first_name` | Yes | |
| `last_name` | Yes | |
| `email` | Yes | |
| `phone` | Yes | |
| `company_name` | Yes | |
| `website` | Yes | |
| `country` | Yes | Full country name (e.g. `United States`), not a 2-char code |
| `business_state` | When US | Only shown and sent when `country = United States` |
| `annual_sales` | Yes | |
| `industry_type` | Yes | **Name** (not slug) — e.g. `E-Commerce`, not `e-commerce` |
| `industry_type_other` | Conditional | Required when `industry_type = other` |
| `promo_code` | Optional | |

**Do NOT add** `highest_transaction_amount`, `card_swiped`, `customer_entered`, `staff_entered`,
`current_processing`, `expected_monthly_volume`, or `marketing_model` to the Integration 2 form.
Those are step-3/5 fields collected later on EMAP.

---

## How it works

1. Your form collects the step-1 fields above.
2. On submit, your page builds: `{EMAP_BASE_URL}/signup?first_name=...&last_name=...&...`
3. The browser follows the redirect (`window.location.href = url`).
4. EMAP's `SignupController::index()` reads the query params and prefills the signup form.
5. When these 5 fields are present (`first_name`, `last_name`, `company_name`, `phone`, `email`),
   EMAP sets `from_lander=1` and auto-saves the partial record in the background.
6. The merchant sees the prefilled form, fills in any remaining fields, and submits.
7. All remaining steps (company info, banking, e-signature) happen on EMAP.

---

## Building the redirect URL

### JavaScript (client-side)

```javascript
function buildEmapRedirectUrl(fields, emapBaseUrl, partnerSecretKey) {
  const params = new URLSearchParams();

  const fieldMap = {
    first_name:    fields.firstName,
    last_name:     fields.lastName,
    email:         fields.email,
    phone:         fields.phone,
    company_name:  fields.companyName,
    website:       fields.website,
    country:       fields.country,       // full country name
    annual_sales:  fields.annualSales,
  };

  if (fields.businessState)     fieldMap.business_state       = fields.businessState;
  fieldMap.industry_type                                       = fields.industryType;
  if (fields.industryTypeOther) fieldMap.industry_type_other  = fields.industryTypeOther;
  if (fields.promoCode)      fieldMap.promo_code          = fields.promoCode;

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value != null && value !== '') params.set(key, value);
  }

  // UTM pass-through from current page
  const currentParams = new URLSearchParams(window.location.search);
  ['utm_campaign','utm_source','utm_medium','utm_term','utm_content','gclid','gbraid','wbraid']
    .forEach(k => { if (currentParams.has(k)) params.set(k, currentParams.get(k)); });

  // Partner attribution — EMAP_PARTNER_SECRET_KEY is a constant set directly
  // in this file (see SKILL.md Step 2); there is no backend to keep it
  // behind, so it's visible in the browser and in the redirect URL itself.
  if (partnerSecretKey) params.set('secretKey', partnerSecretKey);

  return `${emapBaseUrl}/signup?${params.toString()}`;
}
```

---

## URL encoding rules

- Use `URLSearchParams` (JS) or `http_build_query` (PHP) — they handle encoding correctly.
- Do not manually concatenate with `&` and `=` — special characters in values will break the URL.
- **Do not include fields with null or empty-string values** — EMAP may treat empty string as a value.

---

## Partner attribution

EMAP's `getPartnerID()` resolves the `secretKey` URL param to a partner user ID:

```
URL param: secretKey=<partner_security_key>
           ↓
EMAP: User::where('security_key', $request->secretKey)->first()
           ↓
stores: applications.partner_id, companies.partner_id
```

The `secretKey` value is the partner's `security_key` column in EMAP's `users` table.
Set it as the `EMAP_PARTNER_SECRET_KEY` constant directly in the template's `<script>` block — this
form has no backend or `.env` file, so it is visible in the deployed page's JavaScript source. See
the security-checklist.md note on this and SKILL.md's Step 2 for the tradeoff.

---

## UTM tracking

EMAP captures UTM params into the session and stores them on the user and application records
for HubSpot and attribution. Pass them through from your landing page to preserve attribution:

```javascript
function getTrackingParams() {
  const current = new URLSearchParams(window.location.search);
  const tracking = {};
  ['utm_campaign','utm_source','utm_medium','utm_term','utm_content','gclid','gbraid','wbraid']
    .forEach(k => { if (current.has(k)) tracking[k] = current.get(k); });
  return tracking;
}
```

---

## Security considerations

- **PII is in the URL.** The redirect URL contains `first_name`, `last_name`, `email`, and `phone`.
  These appear in:
  - The browser's address bar (briefly)
  - The browser history
  - Your web server's access logs (in the `Referer` header of subsequent requests)
  - The `Referer` header sent to EMAP's analytics scripts

- **Mitigations:**
  1. Set `Referrer-Policy: no-referrer` on your form page response header. This prevents
     your page URL (with PII) from being sent to EMAP's analytics.
  2. Use HTTPS — never HTTP — for both your site and EMAP.
  3. Do not store the redirect URL in your own database or logs.

- **`secretKey` in the URL** is a low-risk referral code (6–35 chars), not a secret API key.
  It is already used in EMAP's `/go/{code}` referral links. Still: add it server-side to avoid
  it appearing in your frontend source code.

---

## Example redirect URL

```
https://emap.epd.dev/signup
  ?first_name=Jane
  &last_name=Smith
  &company_name=Acme+Corp
  &email=jane%40acme.com
  &phone=%2B12025551234
  &website=https%3A%2F%2Facme.com
  &country=United+States
  &business_state=CA
  &annual_sales=500000
  &industry_type=E-Commerce
  &promo_code=PARTNER10
  &secretKey=YOUR_PARTNER_KEY
```

Effect: EMAP form loads prefilled. Auto-save fires in background. Merchant reviews the
prefilled fields, completes any remaining ones, and submits to proceed to step 2.
