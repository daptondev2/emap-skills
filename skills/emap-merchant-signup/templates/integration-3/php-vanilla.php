<?php
/**
 * EMAP Partner Integration 3 — Email-Based Signup (Plain PHP)
 *
 * The partner fills in the merchant's step-1 details and submits.
 * This file proxies the data to EMAP /api/v1/signup, which creates the account
 * and emails the merchant a secure link to complete their full application on
 * Easy Pay Direct's platform.
 *
 * A single file that handles both:
 *   - GET: renders the signup form
 *   - POST: proxies form data to EMAP's API and returns JSON
 *
 * Requirements: PHP 7.4+, curl extension enabled.
 *
 * Environment (set in .env or your server's environment):
 *   EMAP_BASE_URL       = https://emap.epd.dev
 *   EMAP_PARTNER_KEY    = your_partner_key_here   (never expose this)
 *
 * Loading env from a .env file (optional — if you use phpdotenv):
 *   require __DIR__ . '/vendor/autoload.php';
 *   $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
 *   $dotenv->load();
 *
 * Otherwise, set these in your server config (e.g. php-fpm pool, Apache SetEnv,
 * or Nginx fastcgi_param) and they'll be available via $_ENV or getenv().
 */

declare(strict_types=1);

session_start();

// ── Config ────────────────────────────────────────────────────────────────────
$emapBaseUrl = rtrim((string)(getenv('EMAP_BASE_URL') ?: $_ENV['EMAP_BASE_URL'] ?? ''), '/');
$emapPartnerKey = (string)(getenv('EMAP_PARTNER_KEY') ?: $_ENV['EMAP_PARTNER_KEY'] ?? '');

if (!$emapBaseUrl) {
    // In production, fail loudly so misconfiguration is caught during deployment
    error_log('[EMAP] EMAP_BASE_URL is not configured');
    http_response_code(500);
    die('Server configuration error');
}

// ── CSRF token ─────────────────────────────────────────────────────────────────
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION['csrf_token'];

// ── Handle POST requests (API proxy) ─────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

    // Read JSON or form-encoded body
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_contains($contentType, 'application/json')) {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
    } else {
        $input = $_POST;
    }

    // CSRF check
    $submittedToken = $input['_csrf'] ?? $input['csrf_token'] ?? '';
    if (!hash_equals($csrfToken, (string)$submittedToken)) {
        http_response_code(403);
        echo json_encode(['status' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }

    // Honeypot check — silent rejection
    if (!empty($input['_hp'])) {
        // Return success silently to not alert the bot
        echo json_encode(['status' => true, 'message' => 'Success', 'uuid' => '']);
        exit;
    }

    // ── Validation constants ──────────────────────────────────────────────────
    $phoneRegex   = '/^[0-9+\-()\s]+$/';
    $websiteRegex = '/^(https?:\/\/)?[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/i';
    $validUsStates = [
        'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
        'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
        'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
        'VA','WA','WV','WI','WY','DC',
    ];

    // Validate required fields
    $errors = [];
    $firstName     = trim((string)($input['first_name'] ?? ''));
    $lastName      = trim((string)($input['last_name'] ?? ''));
    $email         = trim((string)($input['email'] ?? ''));
    $phone         = trim((string)($input['phone'] ?? ''));
    $name          = trim((string)($input['name'] ?? $input['company_name'] ?? ''));
    $website       = trim((string)($input['website'] ?? ''));
    $country       = strtoupper(trim((string)($input['country'] ?? '')));
    $annualSales   = (float)($input['annual_sales'] ?? 0);
    $businessState      = strtoupper(trim((string)($input['business_state'] ?? '')));
    $industryType       = trim((string)($input['industry_type'] ?? ''));
    $industryTypeOther  = trim((string)($input['industry_type_other'] ?? ''));
    $promoCode          = trim((string)($input['promo_code'] ?? ''));

    if (!$firstName)              $errors['first_name']   = ['First name is required'];
    elseif (strlen($firstName) > 60) $errors['first_name'] = ['First name must be 60 characters or fewer'];

    if (!$lastName)               $errors['last_name']    = ['Last name is required'];
    elseif (strlen($lastName) > 60)  $errors['last_name'] = ['Last name must be 60 characters or fewer'];

    if (!$email)                  $errors['email']        = ['Email is required'];
    elseif (!filter_var($email, FILTER_VALIDATE_EMAIL))
                                  $errors['email']        = ['A valid email address is required'];

    if (!$phone)                  $errors['phone']        = ['Phone is required'];
    elseif (strlen($phone) > 20)  $errors['phone']        = ['Phone must be 20 characters or fewer'];
    elseif (!preg_match($phoneRegex, $phone))
                                  $errors['phone']        = ['Phone may only contain digits, +, -, (, ), and spaces'];

    if (!$name)                   $errors['name']         = ['Company name is required'];
    elseif (strlen($name) > 60)   $errors['name']         = ['Company name must be 60 characters or fewer'];

    if (!$website)                $errors['website']      = ['Website is required'];
    elseif (!preg_match($websiteRegex, $website))
                                  $errors['website']      = ['Website must be a valid URL (e.g. https://yourcompany.com)'];

    if (!$country)                $errors['country']      = ['Country is required'];
    elseif (strlen($country) !== 2) $errors['country']    = ['Country must be a 2-character ISO code (e.g. US, CA)'];

    if ($annualSales < 1)         $errors['annual_sales'] = ['Annual sales must be at least 1'];
    elseif ($annualSales > 999999999999) $errors['annual_sales'] = ['Annual sales value is too large'];

    if ($country === 'US') {
        if (!$businessState)                        $errors['business_state'] = ['State is required for US businesses'];
        elseif (!in_array($businessState, $validUsStates, true))
                                                    $errors['business_state'] = ['Must be a valid 2-character US state code (e.g. CA, TX)'];
    }

    if (!$industryType)     $errors['industry_type'] = ['Industry type is required'];

    if (!empty($errors)) {
        http_response_code(422);
        echo json_encode(['status' => false, 'message' => 'Validation failed', 'errors' => $errors]);
        exit;
    }

    // Build EMAP payload — only known fields; never forward raw user input wholesale
    $payload = [
        'first_name'    => $firstName,
        'last_name'     => $lastName,
        'email'         => strtolower($email),
        'phone'         => $phone,
        'name'          => $name,
        'website'       => $website,
        'country'       => $country,
        'annual_sales'  => $annualSales,
        'industry_type' => $industryType,
    ];
    if ($businessState)     $payload['business_state']      = $businessState;
    if ($industryTypeOther) $payload['industry_type_other'] = $industryTypeOther;
    if ($promoCode)         $payload['promo_code']          = $promoCode;

    // Add partner key from env — never from the request
    if ($emapPartnerKey) {
        $payload['partner_key'] = $emapPartnerKey;
    }

    // EMAP sends the merchant's signup email as part of this same call
    $payload['trigger_email'] = true;

    $result = emapPost($emapBaseUrl . '/api/v1/signup', $payload, $emapPartnerKey);

    if ($result['status_code'] === 429) {
        http_response_code(429);
        echo json_encode(['status' => false, 'message' => 'Too many requests. Please wait a few minutes and try again.']);
        exit;
    }

    http_response_code($result['status_code']);
    echo json_encode($result['body']);
    exit;
}

// ── Helper: POST to EMAP using cURL ──────────────────────────────────────────
function emapPost(string $url, array $payload, string $partnerKey): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Accept: application/json',
        ],
        // Enforce TLS certificate verification
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $responseBody = curl_exec($ch);
    $statusCode   = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError    = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        // Log error message only — never log the payload (contains PII + partner key)
        error_log('[EMAP] cURL error: ' . $curlError);
        return [
            'status_code' => 502,
            'body'        => ['status' => false, 'message' => 'EMAP is temporarily unavailable. Please try again.'],
        ];
    }

    $decoded = json_decode($responseBody, true);
    if ($decoded === null) {
        error_log('[EMAP] Non-JSON response, status=' . $statusCode);
        return [
            'status_code' => 502,
            'body'        => ['status' => false, 'message' => 'EMAP returned an unexpected response.'],
        ];
    }

    return ['status_code' => $statusCode, 'body' => $decoded];
}

// ── GET: industry-types dropdown proxy ───────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['_dropdown']) && $_GET['_dropdown'] === 'industry-types') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    $ch = curl_init($emapBaseUrl . '/api/partner/industry-types');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $body = curl_exec($ch);
    curl_close($ch);
    echo $body ?: json_encode(['data' => []]);
    exit;
}

// ── GET: render the HTML form ─────────────────────────────────────────────────
// Security headers
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Register a Merchant</title>
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
                    border-radius: 7px; font-size: .95rem; }
    input:focus, select:focus { outline: none; border-color: #3b82f6; }
    input.error, select.error { border-color: #ef4444; }
    .field-error { display: block; color: #ef4444; font-size: .8rem; margin-top: 4px; }
    .terms-group { display: flex; align-items: flex-start; gap: 10px; margin: 20px 0; }
    .terms-group input[type="checkbox"] { width: 17px; height: 17px; flex-shrink: 0; margin-top: 2px; }
    .terms-group label { font-size: .88rem; font-weight: 400; color: #4b5563; }
    .terms-group a { color: #3b82f6; }
    button[type="submit"] { width: 100%; padding: 13px; background: #3b82f6; color: #fff;
                             border: none; border-radius: 8px; font-size: 1rem; font-weight: 600;
                             cursor: pointer; }
    button:disabled { opacity: .65; cursor: not-allowed; }
    .alert { padding: 14px 16px; border-radius: 8px; margin-bottom: 20px; font-size: .9rem; }
    .alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .alert-warning { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
    .hp-field { display: none !important; }
    #success-panel { display: none; }
    .success-header { text-align: center; padding: 8px 0 24px; }
    .success-header .icon { font-size: 3rem; display: block; margin-bottom: 12px; }
    .success-header h2 { color: #166534; margin: 0 0 8px; font-size: 1.5rem; }
    .success-header .lead { color: #4b5563; font-size: .95rem; margin: 0 auto; max-width: 380px; }
    .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 22px; margin: 24px 0; }
    .summary-card .summary-title { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin: 0 0 14px; }
    .summary-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 7px 0; border-bottom: 1px solid #e2e8f0; font-size: .9rem; }
    .summary-row:last-child { border-bottom: none; }
    .summary-key { color: #64748b; flex-shrink: 0; }
    .summary-val { color: #0f172a; font-weight: 600; text-align: right; word-break: break-all; }
    .email-sent-box { display: flex; align-items: flex-start; gap: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 18px; margin-bottom: 20px; }
    .email-sent-box .envelope { font-size: 1.6rem; flex-shrink: 0; line-height: 1; }
    .email-sent-box .email-text strong { color: #166534; font-size: .95rem; display: block; margin-bottom: 4px; }
    .email-sent-box .email-text p { margin: 0; color: #4b5563; font-size: .87rem; }
    .reference-note { text-align: center; color: #94a3b8; font-size: .8rem; margin: 12px 0 20px; }
    .btn-register-another { display: block; width: 100%; padding: 12px; background: #f1f5f9; color: #374151; border: 1.5px solid #d1d5db; border-radius: 8px; font-size: .95rem; font-weight: 600; cursor: pointer; text-align: center; }
    .btn-register-another:hover { background: #e2e8f0; }
  </style>
</head>
<body>
<div class="card">
  <h1>Register a Merchant</h1>
  <p class="subtitle">Enter the merchant's details below. They'll receive an email with a secure link to complete their Easy Pay Direct account application.</p>

  <div id="form-alert" class="alert" style="display:none"></div>

  <!-- ── Confirmation page shown after successful signup email is sent ─── -->
  <div id="success-panel">
    <div class="success-header">
      <span class="icon">&#x2705;</span>
      <h2>Merchant Registered</h2>
      <p class="lead">The merchant's details have been saved and Easy Pay Direct has emailed them a secure link to complete their account application.</p>
    </div>
    <div class="summary-card">
      <p class="summary-title">Details Saved</p>
      <div class="summary-row"><span class="summary-key">Name</span><span id="sum-name" class="summary-val"></span></div>
      <div class="summary-row"><span class="summary-key">Email</span><span id="sum-email" class="summary-val"></span></div>
      <div class="summary-row"><span class="summary-key">Company</span><span id="sum-company" class="summary-val"></span></div>
      <div class="summary-row"><span class="summary-key">Phone</span><span id="sum-phone" class="summary-val"></span></div>
      <div class="summary-row"><span class="summary-key">Website</span><span id="sum-website" class="summary-val"></span></div>
    </div>
    <div class="email-sent-box">
      <span class="envelope">&#x2709;&#xFE0F;</span>
      <div class="email-text">
        <strong>Signup email sent to <span id="sum-email-confirm"></span></strong>
        <p>The merchant will receive a link to complete their merchant account on Easy Pay Direct's platform. This typically arrives within a few minutes.</p>
      </div>
    </div>
    <p class="reference-note" id="success-uuid"></p>
    <button type="button" class="btn-register-another" id="btn-register-another">Register Another Merchant</button>
  </div>

  <form id="signup-form" novalidate>
    <!-- CSRF token — must be included in every POST -->
    <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
    <!-- Honeypot -->
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
    <!--
      Note: EMAP's API field is 'name' (company name).
      We send it as 'name' in the fetch payload below.
    -->
    <div class="form-group">
      <label>Company Name <span class="req">*</span></label>
      <input id="company_name" name="company_name" type="text" maxlength="255" autocomplete="organization" required>
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
          <option value="">Select…</option>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
          <option value="GB">United Kingdom</option>
          <option value="AU">Australia</option>
        </select>
        <span class="field-error" id="err_country"></span>
      </div>
      <div class="form-group" id="state_group" style="display:none">
        <label>State <span class="req">*</span></label>
        <select id="business_state" name="business_state">
          <option value="">Select…</option>
          <option value="CA">California</option><option value="TX">Texas</option>
          <option value="NY">New York</option><option value="FL">Florida</option>
          <!-- Add all US states -->
        </select>
        <span class="field-error" id="err_business_state"></span>
      </div>
    </div>

    <div class="form-group">
      <label>Annual Sales (USD) <span class="req">*</span></label>
      <input name="annual_sales" type="number" min="1" required placeholder="e.g. 500000">
      <span class="field-error" id="err_annual_sales"></span>
    </div>
    <div class="form-group">
      <label for="industry_type">Industry Type <span class="req">*</span></label>
      <select id="industry_type" name="industry_type" required>
        <option value="">Loading industries…</option>
      </select>
      <span class="field-error" id="err_industry_type"></span>
    </div>
    <div class="form-group" id="industry_type_other_group" style="display:none">
      <label for="industry_type_other">Describe your industry <span class="req">*</span></label>
      <input id="industry_type_other" name="industry_type_other" type="text" maxlength="255" placeholder="Briefly describe your industry">
      <span class="field-error" id="err_industry_type_other"></span>
    </div>

    <div class="form-group">
      <label>Referral / Promo Code</label>
      <input name="promo_code" type="text" maxlength="255">
    </div>

    <button type="submit" id="submit-btn">Send Signup Link</button>
  </form>
</div>

<script>
  // Load industry types
  (async function() {
    try {
      const res = await fetch('?_dropdown=industry-types');
      const json = await res.json();
      const sel = document.getElementById('industry_type');
      sel.innerHTML = '<option value="">Select industry…</option>';
      (json.data || []).forEach(function(t) {
        const o = document.createElement('option');
        o.value = t.slug; o.textContent = t.name;
        sel.appendChild(o);
      });
    } catch (_) {
      document.getElementById('industry_type').innerHTML =
        '<option value="">Unable to load — please refresh</option>';
    }
  })();

  document.getElementById('industry_type').addEventListener('change', function() {
    const grp = document.getElementById('industry_type_other_group');
    const inp = document.getElementById('industry_type_other');
    // EMAP's live /api/partner/industry-types returns the catch-all option's
    // slug as "Other" (capitalized) — compare case-insensitively.
    const isOther = (this.value || '').toLowerCase() === 'other';
    grp.style.display = isOther ? 'block' : 'none';
    inp.required = isOther;
    if (!isOther) inp.value = '';
  });

  document.getElementById('country').addEventListener('change', function() {
    const sg = document.getElementById('state_group');
    const bs = document.getElementById('business_state');
    const isUS = this.value === 'US';
    sg.style.display = isUS ? 'block' : 'none';
    bs.required = isUS;
    if (!isUS) bs.value = '';
  });

  function setError(id, msg) {
    const el = document.getElementById('err_' + id);
    const inp = document.querySelector('[name="' + id + '"]') || document.getElementById(id);
    if (el) el.textContent = msg || '';
    if (inp) { inp.classList.toggle('error', !!msg); }
  }

  function clearErrors() {
    document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
    document.querySelectorAll('.error').forEach(e => e.classList.remove('error'));
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

  document.getElementById('signup-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    clearErrors();

    if (document.querySelector('[name="_hp"]').value) return;

    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    // Map company_name → name for EMAP API
    data.name = data.company_name;
    delete data.company_name;

    // Client-side industry_type check
    if (!data.industry_type) {
      setError('industry_type', 'Industry type is required');
      return;
    }
    if ((data.industry_type || '').toLowerCase() === 'other' && !data.industry_type_other) {
      setError('industry_type_other', 'Please describe your industry');
      return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      const resp = await fetch(window.location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await resp.json();

      if (resp.status === 429) {
        showAlert('error', 'Too many attempts. Please wait a few minutes and try again.');
        btn.disabled = false; btn.textContent = 'Send Signup Link';
        return;
      }
      if (resp.status === 422) {
        showAlert('error', 'Please correct the errors below.');
        for (const [f, msgs] of Object.entries(result.errors || {})) {
          setError(f === 'name' ? 'company_name' : f, Array.isArray(msgs) ? msgs[0] : msgs);
        }
        btn.disabled = false; btn.textContent = 'Send Signup Link';
        return;
      }
      if (!resp.ok) {
        showAlert('error', 'Something went wrong. Please try again.');
        btn.disabled = false; btn.textContent = 'Send Signup Link';
        return;
      }
      // Existing user — EMAP resent the verification link; treat as success
      if (result.verificationLink === true) {
        showSuccessPanel(data, result.uuid || '', true);
        return;
      }
      // Company already exists
      if (result.status === false && result.message === 'Company already exists') {
        showAlert('warning', 'A company with this name already exists. The merchant may already have an active account.');
        btn.disabled = false; btn.textContent = 'Send Signup Link';
        return;
      }
      // Success — account created, EMAP emailed the merchant a signup link
      if (result.status === true && result.uuid) {
        showSuccessPanel(data, result.uuid, false);
        return;
      }
      showAlert('error', result.message || 'An unexpected error occurred. Please try again.');
      btn.disabled = false; btn.textContent = 'Send Signup Link';
    } catch {
      showAlert('error', 'A network error occurred. Please check your connection and try again.');
      btn.disabled = false; btn.textContent = 'Send Signup Link';
    }
  });

  function showSuccessPanel(data, uuid, isExistingUser) {
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('form-alert').style.display = 'none';

    const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ');
    document.getElementById('sum-name').textContent    = fullName || '—';
    document.getElementById('sum-email').textContent   = data.email || '—';
    document.getElementById('sum-company').textContent = data.name || '—';
    document.getElementById('sum-phone').textContent   = data.phone || '—';
    document.getElementById('sum-website').textContent = data.website || '—';
    document.getElementById('sum-email-confirm').textContent = data.email || 'the merchant';

    const uuidEl = document.getElementById('success-uuid');
    if (isExistingUser) {
      uuidEl.textContent = 'This merchant already has an account — a new signup link has been resent.';
    } else if (uuid) {
      uuidEl.textContent = 'Application reference: ' + uuid;
    }

    document.getElementById('success-panel').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.getElementById('btn-register-another').addEventListener('click', function() {
    document.getElementById('success-panel').style.display = 'none';
    const form = document.getElementById('signup-form');
    form.reset();
    document.getElementById('state_group').style.display = 'none';
    document.getElementById('business_state').required = false;
    document.getElementById('industry_type_other_group').style.display = 'none';
    document.getElementById('industry_type_other').required = false;
    form.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
</script>
</body>
</html>
