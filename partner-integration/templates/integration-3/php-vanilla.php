<?php
/**
 * EMAP Partner Integration 3 — API Submission (Plain PHP)
 *
 * A single file that handles both:
 *   - GET: renders the signup form
 *   - POST: proxies form data to EMAP's API and returns JSON
 *
 * Requirements: PHP 7.4+, curl extension enabled.
 *
 * Environment (set in .env or your server's environment):
 *   EMAP_BASE_URL       = https://app.easypaydirect.com
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

    // Handle resume-link request
    if (isset($input['_action']) && $input['_action'] === 'resume-link') {
        $email = trim((string)($input['email'] ?? ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(422);
            echo json_encode(['status' => false, 'message' => 'A valid email address is required']);
            exit;
        }
        $result = emapPost($emapBaseUrl . '/api/v1/signup/resume-link', ['email' => $email], '');
        http_response_code($result['status_code']);
        echo json_encode($result['body']);
        exit;
    }

    // Validate required fields
    $errors = [];
    $firstName = trim((string)($input['first_name'] ?? ''));
    $lastName  = trim((string)($input['last_name'] ?? ''));
    $email     = trim((string)($input['email'] ?? ''));
    $phone     = trim((string)($input['phone'] ?? ''));
    $name      = trim((string)($input['name'] ?? $input['company_name'] ?? ''));
    $website   = trim((string)($input['website'] ?? ''));
    $country   = strtoupper(trim((string)($input['country'] ?? '')));
    $annualSales = (int)($input['annual_sales'] ?? 0);
    $businessState = strtoupper(trim((string)($input['business_state'] ?? '')));
    $promoCode = trim((string)($input['promo_code'] ?? ''));

    if (!$firstName)      $errors['first_name']   = ['First name is required'];
    if (!$lastName)       $errors['last_name']    = ['Last name is required'];
    if (!$email)          $errors['email']        = ['Email is required'];
    elseif (!filter_var($email, FILTER_VALIDATE_EMAIL))
                          $errors['email']        = ['A valid email address is required'];
    if (!$phone)          $errors['phone']        = ['Phone is required'];
    if (!$name)           $errors['name']         = ['Company name is required'];
    if (!$website)        $errors['website']      = ['Website is required'];
    if (!$country)        $errors['country']      = ['Country is required'];
    if ($annualSales < 1) $errors['annual_sales'] = ['Annual sales must be at least 1'];
    if ($country === 'US' && !$businessState)
                          $errors['business_state'] = ['State is required for US businesses'];

    if (!empty($errors)) {
        http_response_code(422);
        echo json_encode(['status' => false, 'message' => 'Validation failed', 'errors' => $errors]);
        exit;
    }

    // Build EMAP payload — only known fields; never forward raw user input wholesale
    $payload = [
        'first_name'   => $firstName,
        'last_name'    => $lastName,
        'email'        => strtolower($email),
        'phone'        => $phone,
        'name'         => $name,
        'website'      => $website,
        'country'      => $country,
        'annual_sales' => $annualSales,
    ];
    if ($businessState) $payload['business_state'] = $businessState;
    if ($promoCode)     $payload['promo_code']     = $promoCode;

    // Add partner key from env — never from the request
    if ($emapPartnerKey) {
        $payload['partner_key'] = $emapPartnerKey;
    }

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
    .hp-field { display: none !important; }
  </style>
</head>
<body>
<div class="card">
  <h1>Apply for a Merchant Account</h1>
  <p class="subtitle">Fill in your business details to get started.</p>

  <div id="form-alert" class="alert" style="display:none"></div>

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
      <label>Referral / Promo Code</label>
      <input name="promo_code" type="text" maxlength="255">
    </div>

    <div class="terms-group">
      <input type="checkbox" id="terms" name="terms_agreed">
      <label for="terms">I agree to the
        <a href="https://app.easypaydirect.com/terms" target="_blank" rel="noopener">Terms and Conditions</a>
      </label>
    </div>
    <span class="field-error" id="err_terms" style="display:block;margin-top:-10px;margin-bottom:10px"></span>

    <button type="submit" id="submit-btn">Submit Application</button>
  </form>
</div>

<script>
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

    if (!document.getElementById('terms').checked) {
      setError('terms', 'You must agree to the Terms and Conditions');
      return;
    }

    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    // Map company_name → name for EMAP API
    data.name = data.company_name;
    delete data.company_name;
    delete data.terms_agreed;

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    try {
      const resp = await fetch(window.location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await resp.json();

      if (resp.status === 429) {
        showAlert('error', 'Too many attempts. Please wait a few minutes and try again.');
        btn.disabled = false; btn.textContent = 'Submit Application';
        return;
      }
      if (resp.status === 422) {
        showAlert('error', 'Please correct the errors below.');
        for (const [f, msgs] of Object.entries(result.errors || {})) {
          setError(f === 'name' ? 'company_name' : f, Array.isArray(msgs) ? msgs[0] : msgs);
        }
        btn.disabled = false; btn.textContent = 'Submit Application';
        return;
      }
      if (!resp.ok) {
        showAlert('error', 'Something went wrong. Please try again.');
        btn.disabled = false; btn.textContent = 'Submit Application';
        return;
      }
      if (result.verificationLink === true) {
        document.getElementById('signup-form').style.display = 'none';
        showAlert('warning', 'You already have an account. Check your email or click here to continue.');
        if (result.url) {
          const a = document.createElement('a');
          a.href = result.url; a.textContent = 'Continue my application →';
          a.style.cssText = 'display:block;margin-top:10px;color:#3b82f6;font-weight:600';
          document.getElementById('form-alert').after(a);
        }
        return;
      }
      if (result.status === true && result.uuid) {
        document.getElementById('signup-form').style.display = 'none';
        showAlert('success', 'Application submitted! Check your inbox for next steps. Reference: ' + result.uuid);
        return;
      }
      showAlert('error', result.message || 'An unexpected error occurred. Please try again.');
      btn.disabled = false; btn.textContent = 'Submit Application';
    } catch {
      showAlert('error', 'A network error occurred. Please check your connection and try again.');
      btn.disabled = false; btn.textContent = 'Submit Application';
    }
  });
</script>
</body>
</html>
