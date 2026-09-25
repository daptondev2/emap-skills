# API Error Reference

How each integration handles EMAP's responses. Every call is made from the merchant's browser, so
every message here is shown to the merchant: keep it generic and never show EMAP's raw error text.

- [Step 1 signup: `POST /api/v1/signup`](#step-1-signup-post-apiv1signup) (Integrations 1 and 3)
- [Step 1 auto-save: `POST /api/v1/signup/auto-save`](#step-1-auto-save-post-apiv1signupauto-save) (Integrations 1 and 3)
- [Steps 2–6 (Integration 1)](#steps-26-integration-1)
- [Integration 2 (redirect)](#integration-2-redirect)
- [Dropdown `GET`s](#dropdown-gets-apipartner) (all integrations)

---

## Step 1 signup: `POST /api/v1/signup`

| HTTP | Condition | Response body | Recommended action |
|---|---|---|---|
| 200 | New user created | `{"status":true,"message":"Success","uuid":"..."}` | Integration 3: show "Check Your Email". Integration 1: keep the `uuid` in `localStorage` and go to step 2. Never display or log the `uuid`: anyone holding it can continue the application. |
| 200 | Existing user | `{"message":"success","verificationLink":true,"url":"..."}` | Tell the merchant to check their email for a link to continue. Don't link to or navigate to `url`: the email is what proves they own the address. |
| 200 | Company exists | `{"status":false,"message":"Company already exists","data":{...}}` | "An application for this company already exists. Check your inbox for an earlier email from Easy Pay Direct, or contact their support team." |
| 400 | Application creation failed | `{"status":false,"message":"Error while creating application","data":"Something went wrong."}` | "Something went wrong. Please try again." Re-enable the submit button. |
| 403 | Request refused (for example, a blocked region) | `{"status":false,"message":"Unauthorised access."}` | "Sorry, we can't accept applications from your location. Please contact Easy Pay Direct." |
| 422 | Validation error | `{"status":false,"message":"Validation failed","errors":{"field":["message",...]}}` | Display per-field errors from `errors`. See [field mapping](#mapping-422-field-names-to-form-field-ids). |
| 429 | Rate limited | Standard 429; may be HTML | "Too many attempts. Please wait a few minutes and try again." Re-enable the button. Don't retry automatically. |
| 5xx | EMAP server error | varies | "The service is temporarily unavailable. Please try again in a few minutes." |

> **Important:** EMAP returns HTTP 200 for business-logic rejections (company exists, existing user).
> Always check the response body, not just the status code.

### Detecting the response shape

```javascript
async function handleEmapResponse(response) {
  // Parse defensively: a 429 or 5xx is often an HTML page from a rate limiter,
  // proxy or CDN, and response.json() would throw on it.
  let data = null;
  try { data = await response.json(); } catch (_) { /* not JSON */ }

  if (response.status === 429) {
    return { type: 'rate_limit' };
  }

  if (response.status === 422) {
    // Field validation errors
    return { type: 'validation', errors: (data && data.errors) || {} };
  }

  if (!response.ok || !data) {
    // Show a generic message; don't display EMAP's raw message text.
    return { type: 'server_error' };
  }

  // HTTP 200 — check body shape
  if (data.verificationLink === true) {
    return { type: 'existing_user' };        // don't pass data.url on
  }

  if (data.status === true && data.uuid) {
    return { type: 'success', uuid: data.uuid };  // keep in memory only
  }

  if (data.status === false && data.message === 'Company already exists') {
    return { type: 'company_exists' };
  }

  // Unexpected shape — treat as server error
  return { type: 'server_error' };
}
```

### Mapping 422 field names to form field IDs

The `errors` object uses the API field names. Map them to your form inputs:

| API field name | Your form input (suggested) | Common error message |
|---|---|---|
| `first_name` | `#first_name` or `input[name="first_name"]` | "First name is required" |
| `last_name` | `#last_name` | "Last name is required" |
| `email` | `#email` | "Email must be a valid email address" |
| `phone` | `#phone` | "Phone is required" / "Phone must contain only numbers, hyphens, plus signs, and parentheses" |
| `name` | `#company_name` (note: your form may use a different id) | "Company name is required" |
| `website` | `#website` | "Website must be a valid URL" |
| `country` | `#country` | "Country is required" |
| `annual_sales` | `#annual_sales` | "Annual sales is required" / "Annual sales must be at least 1" |
| `business_state` | `#business_state` | "Business state is required for US-based companies" |
| `industry_type` | `#industry_type` | "Industry type is required" |
| `partner_key` | — (a constant set in the script, not a form input the merchant fills in) | Show a generic error to the merchant, and tell the developer to check the key |

A 422 for a field the merchant can't see (such as `partner_key`) must still produce a visible
message. Show the page-level alert even when no input matches.

### Rendering field errors

```javascript
function displayFieldErrors(errors) {
  // Clear previous errors
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('.error-border').forEach(el => el.classList.remove('error-border'));

  // Map API field names to your HTML form field IDs
  const fieldMap = {
    first_name: 'first_name',
    last_name: 'last_name',
    email: 'email',
    phone: 'phone',
    name: 'company_name',        // API uses 'name'; your form may use 'company_name'
    website: 'website',
    country: 'country',
    annual_sales: 'annual_sales',
    business_state: 'business_state',
    industry_type: 'industry_type',
  };

  for (const [apiField, messages] of Object.entries(errors)) {
    const formField = fieldMap[apiField] || apiField;
    const input = document.querySelector(`[name="${formField}"]`);
    if (!input) continue;

    input.classList.add('error-border');

    const errorEl = document.createElement('span');
    errorEl.className = 'field-error';
    errorEl.textContent = Array.isArray(messages) ? messages[0] : messages;
    input.parentNode.insertBefore(errorEl, input.nextSibling);
  }
}
```

Always use `textContent`, never `innerHTML`, for anything that came from EMAP.

---

## Step 1 auto-save: `POST /api/v1/signup/auto-save`

Runs in the background; **never show the merchant anything** for any response.

| HTTP | Condition | Response body | Recommended action |
|---|---|---|---|
| 200 | User created (HubSpot contact is created by a queued job) | `{"success":true,"message":"User has been created successfully."}` | Don't auto-save this email again. |
| 200 | Request refused (blocked region) | `[]` | Ignore. |
| 400 | Email already registered | `{"success":false,"message":"This email already associated with us. Try different email."}` | Don't auto-save this email again; Step 1's submit handles existing users. |
| 422 | Validation error (first error only) | `{"status":false,"message":"Validation errors","data":"Phone number must be at least 10 digits."}` | Ignore; don't resend the same values. |
| 429 | Rate limited (5 per 5 minutes per IP) | `{"success":false,"message":"Too many auto-save attempts. Please try again later.","data":"Rate limit exceeded","retry_after":287}` | Ignore. |
| 500 | Server error | `{"success":false,"message":"An error occurred while processing your request."}` | Ignore. |

The bodies match EMAP's own signup page auto-save (`/signup/auto-save`), so they use `success`, not
`status`, except for the 422.

---

## Steps 2–6 (Integration 1)

Steps 2, 3, 5 and 6 `POST {EMAP_BASE_URL}/api/v1/application/step` with the `uuid` and a
`step_count`. Step 4 `POST`s `{EMAP_BASE_URL}/api/v1/ownership` with the `uuid`, `step_count: 4` and
dot-notation owner fields. Step 1 (`/api/v1/signup`) also sends `step_count: 1`. The template's
`submitStep()` handles all five the same way:

| HTTP | Response | Action |
|---|---|---|
| 200 | `{"status":true,...}` (step 6 also returns `uuid`) | Go to the next step. After step 6, clear the saved progress and navigate the top window to `{EMAP_BASE_URL}/upload-document/{uuid}?redirect=1` |
| 200 | `{"status":false,...}` | Stay on the step and show a generic "Something went wrong. Please try again." |
| 422 | `{"errors":{"field.1":["..."],...}}` | "Please correct the errors below." plus per-field errors. Owner field keys use dot notation (`ssn.1`), so map them to the input's `name` |
| 429 | Standard 429; may be HTML | "Too many attempts. Please wait a few minutes and try again." |
| 5xx | varies | "The service is temporarily unavailable. Please try again." |
| other / not JSON | — | "Something went wrong. Please try again." |
| network error | `fetch` throws | "A network error occurred. Please check your connection and try again." |

Every branch re-enables the button. None of them clears the saved `uuid`, so the merchant can
retry the same step. The merchant can go back to steps 2 to 5 with the Back button, fix a field, and
re-submit that step. A 422 whose `errors` names a Step 1 field (for example a missing
`industry_type` reported at step 6) can't be fixed in this session, because Step 1 is read-only
once saved. The page-level alert still shows. After a reload, the resume notice's "Start a new
application" button lets the merchant start again.

---

## Integration 2 (redirect)

Integration 2 doesn't call EMAP's API, so there are no API errors to handle. The form's only job is
to validate its own fields before navigating. After the navigation, EMAP's `/signup` page shows
its own validation messages on its prefilled form; the partner's page can't see or change them.

If `EMAP_BASE_URL` is empty, the template logs a console error on load so the developer notices
before deploying.

---

## Dropdown `GET`s (`/api/partner/*`)

The templates never show an error for a dropdown. If the live call fails, times out (8 seconds),
returns a non-2xx status, or returns no usable rows, `fetchDropdownData()` uses the embedded
`EMAP_DROPDOWN_FALLBACKS` data instead. Rows without a usable value (an empty country `code` or
industry `slug`) are dropped from both sources.
