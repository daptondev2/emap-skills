<?php
/**
 * EMAP Partner Integration 2 — Redirect Handoff (Plain PHP)
 *
 * A single file that handles both:
 *   - GET:  renders the signup form
 *   - POST: validates fields, builds the EMAP redirect URL, returns JSON
 *           { "status": true, "redirectUrl": "..." }
 *           The browser-side JS then follows redirectUrl.
 *
 * Requirements: PHP 7.4+
 * No cURL needed — this integration never calls EMAP's API directly.
 *
 * Environment (set in your server config or .env loader):
 *   EMAP_BASE_URL           = https://emap.epd.dev
 *   EMAP_PARTNER_SECRET_KEY = your_key_here   (optional; enables partner attribution)
 */

declare(strict_types=1);

session_start();

// ── Config ────────────────────────────────────────────────────────────────────
$emapBaseUrl       = rtrim((string)(getenv('EMAP_BASE_URL') ?: $_ENV['EMAP_BASE_URL'] ?? ''), '/');
$emapPartnerKey    = (string)(getenv('EMAP_PARTNER_SECRET_KEY') ?: $_ENV['EMAP_PARTNER_SECRET_KEY'] ?? '');

if (!$emapBaseUrl) {
    error_log('[EMAP] EMAP_BASE_URL is not configured');
    http_response_code(500);
    die('Server configuration error');
}

// Validate base URL to prevent open redirect
$parsedBase = parse_url($emapBaseUrl);
if (!$parsedBase || !isset($parsedBase['host'])) {
    http_response_code(500);
    die('Server configuration error');
}
$emapOrigin = ($parsedBase['scheme'] ?? 'https') . '://' . $parsedBase['host'];

// ── CSRF token ────────────────────────────────────────────────────────────────
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION['csrf_token'];

// ── Whitelisted form fields — same as Integration 1 Step 1 (basic merchant info only) ──────────
$allowedFormFields = [
    'first_name', 'last_name', 'email', 'phone', 'company_name', 'website',
    'country', 'annual_sales', 'business_state', 'industry_type',
    'industry_type_other', 'promo_code',
];

$trackingFields = [
    'utm_campaign', 'utm_source', 'utm_medium', 'utm_term', 'utm_content',
    'gclid', 'gbraid', 'wbraid',
];

// ── Handle POST (build redirect URL) ─────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('Referrer-Policy: no-referrer');

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    $input = str_contains($contentType, 'application/json')
        ? (json_decode(file_get_contents('php://input'), true) ?? [])
        : $_POST;

    // CSRF check
    $submittedToken = (string)($input['_csrf'] ?? $input['csrf_token'] ?? '');
    if (!hash_equals($csrfToken, $submittedToken)) {
        http_response_code(403);
        echo json_encode(['status' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }

    // Honeypot — silent rejection
    if (!empty($input['_hp'])) {
        echo json_encode(['status' => true, 'redirectUrl' => $emapOrigin . '/signup']);
        exit;
    }

    // ── Validation ────────────────────────────────────────────────────────────
    $phoneRegex   = '/^[0-9+\-()\s]+$/';
    $websiteRegex = '/^(https?:\/\/)?[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/i';
    $validUsStates = [
        'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
        'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
        'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
        'VA','WA','WV','WI','WY','DC',
    ];

    $errors      = [];
    $firstName   = trim((string)($input['first_name']   ?? ''));
    $lastName    = trim((string)($input['last_name']    ?? ''));
    $email       = trim((string)($input['email']        ?? ''));
    $phone       = trim((string)($input['phone']        ?? ''));
    $companyName = trim((string)($input['company_name'] ?? ''));
    $website     = trim((string)($input['website']      ?? ''));
    $country     = trim((string)($input['country'] ?? ''));       // full country name
    $countryCode = strtoupper(trim((string)($input['country_code'] ?? ''))); // ISO code from hidden input
    $annualSales = (float)($input['annual_sales'] ?? 0);
    $bizState    = strtoupper(trim((string)($input['business_state'] ?? '')));

    if (!$firstName)             $errors['first_name']   = 'First name is required';
    elseif (strlen($firstName) > 60) $errors['first_name'] = 'First name must be 60 characters or fewer';

    if (!$lastName)              $errors['last_name']    = 'Last name is required';
    elseif (strlen($lastName) > 60)  $errors['last_name'] = 'Last name must be 60 characters or fewer';

    if (!$email)                 $errors['email']   = 'Email is required';
    elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'A valid email address is required';

    if (!$phone)                 $errors['phone']   = 'Phone is required';
    elseif (strlen($phone) > 20) $errors['phone']   = 'Phone must be 20 characters or fewer';
    elseif (!preg_match($phoneRegex, $phone)) $errors['phone'] = 'Phone may only contain digits, +, -, (, ), and spaces';

    if (!$companyName)           $errors['company_name'] = 'Company name is required';
    elseif (strlen($companyName) > 60) $errors['company_name'] = 'Company name must be 60 characters or fewer';

    if (!$website)               $errors['website'] = 'Website is required';
    elseif (!preg_match($websiteRegex, $website)) $errors['website'] = 'Website must be a valid URL';

    if (!$country)               $errors['country'] = 'Country is required';

    if ($annualSales < 1)        $errors['annual_sales'] = 'Annual sales must be at least 1';
    elseif ($annualSales > 999999999999) $errors['annual_sales'] = 'Annual sales value is too large';

    if ($countryCode === 'US') {
        if (!$bizState)                                   $errors['business_state'] = 'State is required for US businesses';
        elseif (!in_array($bizState, $validUsStates, true)) $errors['business_state'] = 'Must be a valid 2-character US state code';
    }

    if (!empty($errors)) {
        http_response_code(422);
        echo json_encode(['status' => false, 'errors' => $errors]);
        exit;
    }

    // ── Build redirect URL ────────────────────────────────────────────────────
    $params = [];

    foreach ($allowedFormFields as $field) {
        $val = trim((string)($input[$field] ?? ''));
        if ($val !== '') {
            $params[$field] = $val;
        }
    }

    // Pass through UTM/tracking params
    foreach ($trackingFields as $field) {
        $val = trim((string)($input[$field] ?? ''));
        if ($val !== '') $params[$field] = $val;
    }

    // Partner key — always from env, never from the request
    if ($emapPartnerKey !== '') {
        $params['secretKey'] = $emapPartnerKey;
    }

    $redirectUrl = $emapOrigin . '/signup?' . http_build_query($params);

    echo json_encode(['status' => true, 'redirectUrl' => $redirectUrl]);
    exit;
}

// ── GET: render the HTML form ─────────────────────────────────────────────────
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>Apply for a Merchant Account</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #f5f7fa; color: #1a1a2e; margin: 0; padding: 40px 16px; }
    .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px;
            box-shadow: 0 4px 24px rgba(0,0,0,.08); padding: 40px 36px; }
    h1 { font-size: 1.6rem; margin: 0 0 6px; }
    .subtitle { color: #64748b; margin: 0 0 28px; font-size: .95rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { margin-bottom: 18px; }
    label { display: block; font-size: .85rem; font-weight: 600; color: #374151; margin-bottom: 5px; }
    label .req { color: #ef4444; margin-left: 2px; }
    input, select { width: 100%; padding: 10px 13px; border: 1.5px solid #d1d5db;
                    border-radius: 7px; font-size: .95rem; color: #1f2937; background: #fff;
                    transition: border-color .15s; appearance: none; }
    input:focus, select:focus { outline: none; border-color: #3b82f6;
                                box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
    input.error, select.error { border-color: #ef4444; }
    .field-error { display: block; color: #ef4444; font-size: .8rem; margin-top: 4px; }
    .terms-group { display: flex; align-items: flex-start; gap: 10px; margin: 20px 0; }
    .terms-group input[type="checkbox"] { width: 17px; height: 17px; flex-shrink: 0; margin-top: 2px; }
    .terms-group label { font-size: .88rem; font-weight: 400; color: #4b5563; }
    .terms-group a { color: #3b82f6; }
    button[type="submit"] { width: 100%; padding: 13px; background: #3b82f6; color: #fff;
                             border: none; border-radius: 8px; font-size: 1rem; font-weight: 600;
                             cursor: pointer; transition: background .15s, opacity .15s; }
    button[type="submit"]:hover:not(:disabled) { background: #2563eb; }
    button:disabled { opacity: .65; cursor: not-allowed; }
    .alert { padding: 12px 16px; border-radius: 7px; margin-bottom: 20px; font-size: .9rem; }
    .alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .hp-field { display: none !important; }
  </style>
</head>
<body>
<div class="card">
  <h1>Apply for a Merchant Account</h1>
  <p class="subtitle">Fill in your business details to get started.</p>

  <div id="form-alert" class="alert" style="display:none"></div>

  <form id="signup-form" novalidate>
    <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
    <input class="hp-field" name="_hp" tabindex="-1" autocomplete="off">

    <div class="form-row">
      <div class="form-group">
        <label>First Name <span class="req">*</span></label>
        <input name="first_name" type="text" maxlength="255" autocomplete="given-name" required>
        <span class="field-error" id="err_first_name"></span>
      </div>
      <div class="form-group">
        <label>Last Name <span class="req">*</span></label>
        <input name="last_name" type="text" maxlength="255" autocomplete="family-name" required>
        <span class="field-error" id="err_last_name"></span>
      </div>
    </div>

    <div class="form-group">
      <label>Email Address <span class="req">*</span></label>
      <input name="email" type="email" maxlength="255" autocomplete="email" required>
      <span class="field-error" id="err_email"></span>
    </div>
    <div class="form-group">
      <label>Phone <span class="req">*</span></label>
      <input name="phone" type="tel" maxlength="20" autocomplete="tel" placeholder="+1 202 555 1234" required>
      <span class="field-error" id="err_phone"></span>
    </div>
    <div class="form-group">
      <label>Company Name <span class="req">*</span></label>
      <input name="company_name" type="text" maxlength="255" autocomplete="organization" required>
      <span class="field-error" id="err_company_name"></span>
    </div>
    <div class="form-group">
      <label>Website <span class="req">*</span></label>
      <input name="website" type="url" maxlength="255" autocomplete="url" placeholder="https://yourcompany.com" required>
      <span class="field-error" id="err_website"></span>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Country <span class="req">*</span></label>
        <select id="country" name="country" required>
          <option value="">Loading countries…</option>
        </select>
        <span class="field-error" id="err_country"></span>
      </div>
      <div class="form-group" id="state_group" style="display:none">
        <label>State <span class="req">*</span></label>
        <select id="business_state" name="business_state">
          <option value="">Loading states…</option>
        </select>
        <span class="field-error" id="err_business_state"></span>
      </div>
    </div>

    <!-- Hidden field: ISO country code — set by JS on country change for US state detection -->
    <input type="hidden" name="country_code" id="country_code">

    <div class="form-group">
      <label>Annual Sales (USD) <span class="req">*</span></label>
      <input name="annual_sales" type="number" min="1" required placeholder="e.g. 500000">
      <span class="field-error" id="err_annual_sales"></span>
    </div>

    <div class="form-group">
      <label>Industry Type <span class="req">*</span></label>
      <select id="industry_type" name="industry_type" required>
        <option value="">Loading industries…</option>
      </select>
      <span class="field-error" id="err_industry_type"></span>
    </div>
    <div class="form-group" id="industry_type_other_group" style="display:none">
      <label>Describe your industry <span class="req">*</span></label>
      <input id="industry_type_other" name="industry_type_other" type="text" maxlength="255">
      <span class="field-error" id="err_industry_type_other"></span>
    </div>

    <div class="form-group">
      <label>Referral / Promo Code</label>
      <input name="promo_code" type="text" maxlength="255" autocomplete="off">
    </div>

    <button type="submit" id="submit-btn">Continue to Easy Pay Direct →</button>
  </form>
</div>

<script>
  // ── Load dynamic dropdowns from EMAP API ────────────────────────────────────
  const EMAP_BASE_URL = '<?= htmlspecialchars($emapBaseUrl, ENT_QUOTES, 'UTF-8') ?>';

  const FALLBACK_COUNTRIES = [
    { code: 'US', name: 'United States' }, { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' }, { code: 'AU', name: 'Australia' },
  ];

  async function loadDropdowns() {
    // Countries — value = full name (EMAP expects the name in URL params), data-code = ISO code
    try {
      const res  = await fetch(EMAP_BASE_URL + '/api/partner/countries');
      const json = await res.json();
      populateCountries(json.data || []);
    } catch (_) {
      populateCountries(FALLBACK_COUNTRIES);
    }

    // States
    try {
      const res  = await fetch(EMAP_BASE_URL + '/api/partner/states');
      const json = await res.json();
      populateSelect('business_state', json.data || [], 'code', 'name', 'Select state…');
    } catch (_) {
      document.getElementById('business_state').innerHTML = '<option value="">Unable to load — please refresh</option>';
    }

    // Industry types — value = name (sent as URL param to EMAP), data-slug = slug (for "other" detection)
    try {
      const res  = await fetch(EMAP_BASE_URL + '/api/partner/industry-types');
      const json = await res.json();
      populateIndustryTypes(json.data || []);
    } catch (_) {
      document.getElementById('industry_type').innerHTML = '<option value="">Unable to load — please refresh</option>';
    }
  }

  function populateIndustryTypes(items) {
    const sel = document.getElementById('industry_type');
    sel.innerHTML = '<option value="">Select industry…</option>';
    items.forEach(function (item) {
      const o = document.createElement('option');
      o.value = item.name;         // name → sent as URL param to EMAP
      o.dataset.slug = item.slug;  // slug → used only for "other" conditional
      o.textContent = item.name;
      sel.appendChild(o);
    });
  }

  function populateCountries(items) {
    const sel = document.getElementById('country');
    sel.innerHTML = '<option value="">Select country…</option>';
    items.forEach(function (item) {
      const o = document.createElement('option');
      o.value = item.name;          // full name → sent as URL param to EMAP
      o.dataset.code = item.code;   // ISO code → used only for state toggle
      o.textContent = item.name;
      sel.appendChild(o);
    });
  }

  function populateSelect(id, items, valueKey, labelKey, placeholder) {
    const sel = document.getElementById(id);
    sel.innerHTML = '<option value="">' + placeholder + '</option>';
    items.forEach(function (item) {
      const o = document.createElement('option');
      o.value = item[valueKey]; o.textContent = item[labelKey];
      sel.appendChild(o);
    });
  }

  document.addEventListener('DOMContentLoaded', loadDropdowns);

  // Country → state toggle (check data-code, not value, since value is now the country name)
  document.getElementById('country').addEventListener('change', function () {
    const code = this.options[this.selectedIndex]?.dataset.code || '';
    document.getElementById('country_code').value = code;
    const isUS = code === 'US';
    const grp  = document.getElementById('state_group');
    const sel  = document.getElementById('business_state');
    grp.style.display = isUS ? 'block' : 'none';
    sel.required = isUS;
    if (!isUS) sel.value = '';
  });

  // Industry type → other field (check data-slug, not value, since value is now the name)
  document.getElementById('industry_type').addEventListener('change', function () {
    // EMAP's live /api/partner/industry-types returns the catch-all option's
    // slug as "Other" (capitalized) — compare case-insensitively.
    const isOther = (this.options[this.selectedIndex]?.dataset.slug || '').toLowerCase() === 'other';
    const grp = document.getElementById('industry_type_other_group');
    const inp = document.getElementById('industry_type_other');
    grp.style.display = isOther ? 'block' : 'none';
    inp.required = isOther;
    if (!isOther) inp.value = '';
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function setError(id, msg) {
    const el  = document.getElementById('err_' + id);
    const inp = document.querySelector('[name="' + id + '"]') || document.getElementById(id);
    if (el)  el.textContent = msg || '';
    if (inp) inp.classList.toggle('error', !!msg);
  }

  function clearErrors() {
    document.querySelectorAll('.field-error').forEach(function (e) { e.textContent = ''; });
    document.querySelectorAll('.error').forEach(function (e) { e.classList.remove('error'); });
    const a = document.getElementById('form-alert');
    a.style.display = 'none'; a.className = 'alert';
  }

  function showAlert(type, msg) {
    const a = document.getElementById('form-alert');
    a.className = 'alert alert-' + type;
    a.textContent = msg;
    a.style.display = 'block';
    a.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Form submit ───────────────────────────────────────────────────────────────
  document.getElementById('signup-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors();

    if (document.querySelector('[name="_hp"]').value) return;

    const data = Object.fromEntries(new FormData(this).entries());

    const btn = document.getElementById('submit-btn');
    btn.disabled = true; btn.textContent = 'Redirecting…';

    try {
      const resp   = await fetch(window.location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await resp.json();

      if (resp.status === 422) {
        showAlert('error', 'Please correct the errors below.');
        for (const [f, msg] of Object.entries(result.errors || {})) {
          setError(f, Array.isArray(msg) ? msg[0] : msg);
        }
        btn.disabled = false; btn.textContent = 'Continue to Easy Pay Direct →';
        return;
      }

      if (!resp.ok || !result.redirectUrl) {
        showAlert('error', 'Something went wrong. Please try again.');
        btn.disabled = false; btn.textContent = 'Continue to Easy Pay Direct →';
        return;
      }

      window.location.href = result.redirectUrl;
    } catch (_) {
      showAlert('error', 'A network error occurred. Please check your connection and try again.');
      btn.disabled = false; btn.textContent = 'Continue to Easy Pay Direct →';
    }
  });
</script>
</body>
</html>
