# Integration 2: Redirect Handoff — Deep Reference

## How it works

1. Your form collects step-1 data.
2. On submit, your page builds: `{EMAP_BASE_URL}/signup?first_name=...&last_name=...&...`
3. The browser follows the redirect (`window.location.href = url`).
4. EMAP's `SignupController::index()` reads the query params and prefills the signup form.
5. Depending on which fields are present, EMAP either shows the form (merchant submits manually)
   or auto-submits it (merchant lands directly on step 2).
6. All remaining steps (company info, banking, e-signature) happen on EMAP.

---

## Auto-submit levels

EMAP has two tiers of automatic behaviour, controlled by which fields are in the URL:

### Tier 1 — From-lander (auto-save)

Triggered when these 5 fields are ALL present and non-empty:
`first_name`, `last_name`, `company_name`, `phone`, `email`

**Effect:** EMAP sets `from_lander=1`. The page JS validates the visible form fields and calls
`autoSave()` in the background. The merchant's partial record is created in EMAP silently.
The merchant **still sees the form** and must fill in any remaining fields and submit manually.

**Use this when:** you only have basic contact info and want EMAP to capture it early.

### Tier 2 — Full auto-submit

Triggered when ALL of the following fields are present and non-empty:

```
company_name, website, first_name, last_name, phone, country,
annual_sales, highest_transaction_amount, industry_type, marketing_model,
card_swiped, customer_entered, staff_entered, current_processing,
expected_monthly_volume
```

These fields are NOT checked (they can be absent):
`promo_code`, `provider_id`, `provider_name`, `industry_type_other`, `business_state`

**Effect:** EMAP sets `$auto_submit=true`. After the page loads, a JS `setInterval` waits for
the preloader to hide, then programmatically clicks the submit button. The merchant skips the
form entirely and lands on step 2.

**Use this when:** you have a complete step-1 data set and want a seamless, one-click experience.

---

## Building the redirect URL

### JavaScript (client-side)

```javascript
function buildEmapRedirectUrl(fields, emapBaseUrl, partnerSecretKey) {
  const params = new URLSearchParams();

  // Core fields (use your field values)
  const fieldMap = {
    first_name: fields.firstName,
    last_name: fields.lastName,
    email: fields.email,
    phone: fields.phone,
    company_name: fields.companyName,
    website: fields.website,
    country: fields.country,
    annual_sales: fields.annualSales,
  };

  if (fields.businessState) {
    fieldMap.business_state = fields.businessState;
  }

  // Optional auto-submit fields
  if (fields.highestTransactionAmount) fieldMap.highest_transaction_amount = fields.highestTransactionAmount;
  if (fields.industryType)             fieldMap.industry_type = fields.industryType;
  if (fields.cardSwiped != null)       fieldMap.card_swiped = fields.cardSwiped;
  if (fields.customerEntered != null)  fieldMap.customer_entered = fields.customerEntered;
  if (fields.staffEntered != null)     fieldMap.staff_entered = fields.staffEntered;
  if (fields.currentProcessing != null) fieldMap.current_processing = fields.currentProcessing;
  if (fields.expectedMonthlyVolume)    fieldMap.expected_monthly_volume = fields.expectedMonthlyVolume;
  if (fields.promoCode)                fieldMap.promo_code = fields.promoCode;

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value != null && value !== '') params.set(key, value);
  }

  // marketing_model is an array — append each value separately
  if (Array.isArray(fields.marketingModel)) {
    fields.marketingModel.forEach(v => params.append('marketing_model[]', v));
  }

  // UTM pass-through from current page
  const currentParams = new URLSearchParams(window.location.search);
  ['utm_campaign','utm_source','utm_medium','utm_term','utm_content','gclid','gbraid','wbraid']
    .forEach(k => { if (currentParams.has(k)) params.set(k, currentParams.get(k)); });

  // Partner attribution (only if you have the key available client-side;
  // prefer server-side approach below for cleaner separation)
  if (partnerSecretKey) params.set('secretKey', partnerSecretKey);

  return `${emapBaseUrl}/signup?${params.toString()}`;
}
```

### Server-side (Node.js — recommended for partner key)

```javascript
function buildEmapRedirectUrl(fields, emapBaseUrl, partnerSecretKey) {
  const params = new URLSearchParams();

  const allowed = [
    'first_name','last_name','email','phone','company_name','website','country',
    'annual_sales','business_state','highest_transaction_amount','industry_type',
    'card_swiped','customer_entered','staff_entered','current_processing',
    'expected_monthly_volume','promo_code',
    'utm_campaign','utm_source','utm_medium','utm_term','utm_content',
    'gclid','gbraid','wbraid',
  ];

  allowed.forEach(k => {
    if (fields[k] != null && fields[k] !== '') params.set(k, fields[k]);
  });

  if (Array.isArray(fields.marketing_model)) {
    fields.marketing_model.forEach(v => params.append('marketing_model[]', v));
  }

  // Partner key comes from env, not from the incoming request
  if (partnerSecretKey) params.set('secretKey', partnerSecretKey);

  return `${emapBaseUrl}/signup?${params.toString()}`;
}
```

---

## URL encoding rules

- Use `URLSearchParams` (JS) or `http_build_query` (PHP) — they handle encoding correctly.
- Array fields (`marketing_model[]`): use `params.append('marketing_model[]', value)` for each item.
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
Store it as `EMAP_PARTNER_SECRET_KEY` in your `.env` and append it server-side (never hardcode it
in a JavaScript file that ships to the browser).

---

## UTM tracking

EMAP captures UTM params into the session and stores them on the user and application records
for HubSpot and attribution. Pass them through from your landing page to preserve attribution:

```javascript
// Read all tracking params from the current page URL
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

## Minimal example (from_lander only)

```
https://emap.epd.dev/signup
  ?first_name=Jane
  &last_name=Smith
  &company_name=Acme+Corp
  &email=jane%40acme.com
  &phone=%2B12025551234
```

Effect: Form loads prefilled with 5 fields. Auto-save fires in background. Merchant fills
in remaining fields (website, country, industry type, etc.) and submits manually.

---

## Full auto-submit example

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
  &highest_transaction_amount=5000
  &industry_type=E-Commerce
  &marketing_model%5B%5D=1
  &card_swiped=0
  &customer_entered=100
  &staff_entered=0
  &current_processing=1
  &expected_monthly_volume=40000
  &secretKey=YOUR_PARTNER_KEY
```

Effect: Page loads, preloader clears, form auto-submits. Merchant lands on step 2.
