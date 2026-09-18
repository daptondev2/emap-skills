# API Error Reference (Integration 3)

Complete error handling guide for `POST /api/v1/signup`.

---

## Signup endpoint errors

| HTTP | Condition | Response body | Recommended action |
|---|---|---|---|
| 200 | New user created | `{"status":true,"message":"Success","uuid":"..."}` | Show "Application submitted! Check your inbox." Store `uuid` if needed. |
| 200 | Existing user | `{"message":"success","verificationLink":true,"url":"..."}` | Show "You already have an account. Check your email or click here." Optionally redirect to `url`. |
| 200 | Company exists | `{"status":false,"message":"Company already exists","data":{...}}` | Show "A company with this name already exists in our system. Please check your email." |
| 400 | Application creation failed | `{"status":false,"message":"Error while creating application","data":"Something went wrong."}` | Show generic "Something went wrong. Please try again." Re-enable the submit button. |
| 403 | IP geofenced (PK) | `{"status":false,"message":"Unauthorised access."}` | Show "This service is not available in your region." |
| 422 | Validation error | `{"status":false,"message":"Validation failed","errors":{"field":["message",...]}}` | Display per-field errors from `errors`. See field mapping below. |
| 429 | Rate limited | `{"status":false,"message":"Too many attempts. Please try again later.","retry_after":<seconds>}` — verified directly against the live API (triggers reliably after ~10 signup attempts within a few minutes from the same source) | Show "Too many attempts. Please wait a few minutes and try again." Optionally use `retry_after` to tell the merchant how long to wait or to schedule an automatic retry. |
| 5xx | EMAP server error | varies | Show "EMAP is temporarily unavailable. Please try again in a few minutes." |

> **Important:** EMAP returns HTTP 200 for business-logic rejections (company exists, existing user).
> Always check the response body, not just the status code.

---

## Detecting the success shape vs existing-user shape

```javascript
async function handleEmapResponse(response) {
  const data = await response.json();

  if (response.status === 422) {
    // Field validation errors
    return { type: 'validation', errors: data.errors };
  }

  if (response.status === 429) {
    return { type: 'rate_limit', retryAfter: data.retry_after };
  }

  if (response.status >= 400) {
    return { type: 'server_error' };
  }

  // HTTP 200 — check body shape
  if (data.verificationLink === true) {
    return { type: 'existing_user', url: data.url };
  }

  if (data.status === true && data.uuid) {
    return { type: 'success', uuid: data.uuid };
  }

  if (data.status === false && data.message === 'Company already exists') {
    return { type: 'company_exists' };
  }

  // Unexpected shape — treat as server error
  return { type: 'server_error' };
}
```

---

## Mapping 422 field names to form field IDs

The `errors` object uses the API field names. Map them to your form inputs:

| API field name | Your form input (suggested) | Common error message |
|---|---|---|
| `first_name` | `#first_name` or `input[name="first_name"]` | "First name is required" |
| `last_name` | `#last_name` | "Last name is required" |
| `email` | `#email` | "This email address is already registered" / "Email must be a valid email address" |
| `phone` | `#phone` | "Phone is required" / "Phone must contain only numbers, hyphens, plus signs, and parentheses" |
| `name` | `#company_name` (note: your form may use a different id) | "Company name is required" |
| `website` | `#website` | "Website must be a valid URL" |
| `country` | `#country` | "Country is required" |
| `annual_sales` | `#annual_sales` | "Annual sales is required" / "Annual sales must be at least 1" |
| `business_state` | `#business_state` | "Business state is required for US-based companies" |
| `partner_key` | — (a constant set in the script, not a form input the merchant fills in) | "Partner key is not valid" — Integration 1 and 3's templates already retry the submission once automatically with `partner_key` omitted when this specific error is seen, so the merchant never encounters it in practice; if you see this surfaced to a merchant, the auto-retry didn't fire — check the key wasn't already empty, and surface a generic error, not this raw message |

---

## Rendering field errors

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
