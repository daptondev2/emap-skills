# Integration 2: Redirect Handoff — Deep Reference

## What Integration 2 is

Integration 2 is a **single-step form** on the partner's site that collects the same basic
merchant info as Integration 1 Step 1 (name, email, phone, company, website, country, sales, etc.).
**There is no Terms and Conditions checkbox** — the merchant agrees to terms on EMAP after step 6.

On submit, all collected fields are serialized as URL query parameters and the browser navigates
to `{EMAP_BASE_URL}/signup?{params}`. EMAP reads the params and prefills its own step-1 form. If the
prefilled data is complete and valid, EMAP submits it for the merchant (see
[How it works](#how-it-works)); otherwise the merchant reviews it and submits.

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
| `country` | Yes | Full country **name** (e.g. `United States`), not the 2-letter code. The schema's `integration2UrlValue` says so. Keep the code in `data-code` for the form's own logic |
| `business_state` | When US | State **code** (e.g. `CA`). Only shown and sent when the selected country's code is `US` |
| `annual_sales` | Yes | |
| `industry_type` | Yes | Industry **name** (e.g. `E-Commerce`), not the slug. Keep the slug in `data-slug` |
| `industry_type_other` | Conditional | Required when the selected industry's slug is `other`, compared case-insensitively (EMAP returns `Other`) |
| `promo_code` | Optional | |

**Do NOT add** `highest_transaction_amount`, `card_swiped`, `customer_entered`, `staff_entered`,
`current_processing`, `expected_monthly_volume`, or `marketing_model` to the Integration 2 form.
Those are step-3/5 fields collected later on EMAP.

---

## How it works

Observed on EMAP's test server (`https://emap.epd.dev`):

1. Your form collects the step-1 fields above.
2. On submit, your page builds `{EMAP_BASE_URL}/signup?first_name=...&last_name=...&...`.
3. The browser navigates there (`navigateTop(url)`, which targets the top window when the form is
   in an iframe).
4. EMAP's `/signup` page reads the query params and prefills its form.
5. **Auto-submit.** When `first_name`, `last_name`, `company_name`, `phone` and `email` are all
   present, EMAP's page runs its own validation on the prefilled form (company name, first and last
   name, website, email and annual sales). If that passes, it saves the record itself and takes the
   merchant straight to step 2. If any check fails, or one of the five params is missing, the
   merchant sees the prefilled form, fixes or completes it, and submits.
6. All remaining steps (company info, banking, e-signature) happen on EMAP.

Confirm step 5 on production before launch; it was observed only on the test server.

---

## Building the redirect URL

### JavaScript (client-side)

```javascript
function buildEmapRedirectUrl(fields, emapBaseUrl, partnerKey) {
  const params = new URLSearchParams();

  const fieldMap = {
    first_name:    fields.firstName,
    last_name:     fields.lastName,
    email:         fields.email,
    phone:         fields.phone,
    company_name:  fields.companyName,
    website:       fields.website,
    country:       fields.countryName,   // display name, not the code
    annual_sales:  fields.annualSales,
    industry_type: fields.industryName,  // display name, not the slug
  };

  if (fields.businessState)     fieldMap.business_state      = fields.businessState;
  if (fields.industryTypeOther) fieldMap.industry_type_other = fields.industryTypeOther;
  if (fields.promoCode)         fieldMap.promo_code          = fields.promoCode;

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value != null && value !== '') params.set(key, value);
  }

  // UTM and Google click-ID pass-through from the current page
  const currentParams = new URLSearchParams(window.location.search);
  // (the templates read them through getTrackingParams(): new params replace, else stored ones reused, 30 days in localStorage)
  ['utm_campaign','utm_source','utm_medium','utm_term','utm_content','gclid','gbraid','wbraid','fbclid']
    .forEach(k => { if (currentParams.has(k)) params.set(k, currentParams.get(k)); });

  // Partner attribution. EMAP names this URL param `secretKey`, but the value is
  // the partner key: an attribution value, visible in the page and in this URL.
  if (partnerKey) params.set('secretKey', partnerKey);

  return `${emapBaseUrl}/signup?${params.toString()}`;
}
```

---

## URL encoding rules

- Use `URLSearchParams`. It handles encoding correctly.
- Do not manually concatenate with `&` and `=` — special characters in values will break the URL.
- **Do not include fields with null or empty-string values** — EMAP may treat empty string as a value.

---

## Partner attribution

EMAP reads the `secretKey` URL param and links the new application to the partner with that key.
The value is the same partner key the other integrations send as `partner_key`; only the parameter
name differs. Set it in the template's `EMAP_PARTNER_KEY` constant. The form has no backend or
`.env` file, so the key is visible in the deployed page's JavaScript and in the redirect URL. See
`SKILL.md` Step 2 for the tradeoff.

---

## UTM tracking

EMAP stores UTM params with the application for attribution. Pass them through from your landing
page:

```javascript
function getTrackingParams() {
  const current = new URLSearchParams(window.location.search);
  const tracking = {};
  ['utm_campaign','utm_source','utm_medium','utm_term','utm_content','gclid','gbraid','wbraid','fbclid']
    .forEach(k => { if (current.has(k)) tracking[k] = current.get(k); });
  return tracking;
}
```

The shipped template goes further: `getTrackingParams()` uses new URL params when present
(replacing the stored ones) and otherwise reuses the stored ones from `localStorage`
(`emap_tracking`, 30 days), so a refresh or a later direct return keeps the source. Integrations 1
and 3 use the same storage key and expiry, so one visitor has one attribution across all three. EMAP's `/signup` page doesn't read `fbclid` yet; it's passed
along in case it does.

`gclid`, `gbraid` and `wbraid` are all Google Ads click IDs. The templates don't pass Bing's
`msclkid`; confirm with Easy Pay Direct that EMAP stores it before adding it.

---

## Security considerations

**PII is in the URL.** The redirect URL contains `first_name`, `last_name`, `email` and `phone`, so
it can end up in:
- the browser's address bar and history
- the `Referer` header that EMAP's `/signup` page sends to anything it loads
- EMAP's access logs and any proxy or log tool in front of EMAP

What the partner can do:
1. Use HTTPS for your own site. The redirect target is always HTTPS.
2. Don't store or log the redirect URL: no analytics event, error report or console log that
   includes it.
3. Tell the developer this exposure comes with the redirect mode. If it's unacceptable, use
   Integration 3, which sends the data in a POST body.

A `Referrer-Policy` header on the *partner's* page doesn't help. The PII is in the URL of EMAP's
page, not the partner's, so only EMAP can keep it out of the `Referer` header that its page sends
(for example with `Referrer-Policy: no-referrer` and by removing the params from the address bar
after reading them). That is on EMAP's side.

---

## Example redirect URL

```
https://emap.epd.dev/signup            ← EMAP's TEST server; use the production URL at launch
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

Effect: EMAP loads its form prefilled. All five auto-submit params are present, so if EMAP's
checks pass it submits for the merchant, who lands on step 2. If a check fails (for example an
unrecognised website), the merchant sees the prefilled form and submits it.
