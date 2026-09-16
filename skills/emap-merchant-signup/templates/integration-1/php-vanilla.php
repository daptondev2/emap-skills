<?php
/**
 * EMAP Partner Integration 1 — Full 6-Step Form (Plain PHP)
 *
 * A single file that handles:
 *   - GET:  renders the 6-step signup form (serves plain-html.html or inline HTML)
 *   - POST: proxies each step to EMAP's API and returns JSON
 *
 * Requirements: PHP 7.4+, curl extension enabled.
 *
 * Environment (set in your server config or .env loader):
 *   EMAP_BASE_URL    = https://emap.epd.dev
 *   EMAP_PARTNER_KEY = your_partner_key_here   (never expose this)
 *
 * POST endpoints (matched via the `_step` body field):
 *   _step=1  → EMAP POST /api/v1/signup             (ExternalSignupRequest)
 *   _step=2  → EMAP POST /api/v1/application/step   (step_count=2)
 *   _step=3  → EMAP POST /api/v1/application/step   (step_count=3)
 *   _step=4  → EMAP POST /api/v1/ownership          (HandleOwnershipRequest)
 *   _step=5  → EMAP POST /api/v1/application/step   (step_count=5)
 *   _step=6  → EMAP POST /api/v1/application/step   (step_count=6)
 *
 * Dropdown endpoints (GET, matched via the `_dropdown` query param):
 *   ?_dropdown=countries        → EMAP GET /api/partner/countries
 *   ?_dropdown=states           → EMAP GET /api/partner/states
 *   ?_dropdown=industry-types   → EMAP GET /api/partner/industry-types
 *   ?_dropdown=shopping-carts   → EMAP GET /api/partner/shopping-carts
 *   ?_dropdown=referral-sources → EMAP GET /api/partner/referral-sources
 *   ?_dropdown=interest-details → EMAP GET /api/partner/interest-details
 */

declare(strict_types=1);

session_start();

// ── Config ────────────────────────────────────────────────────────────────────
$emapBaseUrl    = rtrim((string)(getenv('EMAP_BASE_URL') ?: $_ENV['EMAP_BASE_URL'] ?? ''), '/');
$emapPartnerKey = (string)(getenv('EMAP_PARTNER_KEY')  ?: $_ENV['EMAP_PARTNER_KEY']  ?? '');

if (!$emapBaseUrl) {
    error_log('[EMAP] EMAP_BASE_URL is not configured');
    http_response_code(500);
    die('Server configuration error');
}

$parsedBase = parse_url($emapBaseUrl);
if (!$parsedBase || !isset($parsedBase['host'])) {
    http_response_code(500);
    die('Server configuration error');
}
$emapOrigin = ($parsedBase['scheme'] ?? 'https') . '://' . $parsedBase['host'];
if (isset($parsedBase['port'])) {
    $emapOrigin .= ':' . $parsedBase['port'];
}

// ── CSRF token ────────────────────────────────────────────────────────────────
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION['csrf_token'];

// ── Dropdown proxy (GET ?_dropdown=... OR path-based /api/* routes) ──────────
$dropdownMap = [
    'countries'        => '/api/partner/countries',
    'states'           => '/api/partner/states',
    'industry-types'   => '/api/partner/industry-types',
    'shopping-carts'   => '/api/partner/shopping-carts',
    'referral-sources' => '/api/partner/referral-sources',
    'interest-details' => '/api/partner/interest-details',
];

// Also support path-based routes used by plain-html.html (/api/countries, etc.)
$requestPath = strtok($_SERVER['REQUEST_URI'] ?? '', '?');
$pathToKey = [
    '/api/countries'        => 'countries',
    '/api/states'           => 'states',
    '/api/industry-types'   => 'industry-types',
    '/api/shopping-carts'   => 'shopping-carts',
    '/api/referral-sources' => 'referral-sources',
    '/api/interest-details' => 'interest-details',
];
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($pathToKey[$requestPath])) {
    $_GET['_dropdown'] = $pathToKey[$requestPath];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['_dropdown'])) {
    $key = (string)$_GET['_dropdown'];
    if (!isset($dropdownMap[$key])) {
        http_response_code(400);
        echo json_encode(['data' => []]);
        exit;
    }
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=3600');

    $ch = curl_init($emapOrigin . $dropdownMap[$key]);
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

// ── Handle POST (step proxy) ──────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    $input = str_contains($contentType, 'application/json')
        ? (json_decode(file_get_contents('php://input'), true) ?? [])
        : $_POST;

    // CSRF check
    $submittedToken = (string)($input['_csrf'] ?? '');
    if (!hash_equals($csrfToken, $submittedToken)) {
        http_response_code(403);
        echo json_encode(['status' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }

    // Honeypot
    if (!empty($input['_hp'])) {
        echo json_encode(['status' => true, 'message' => 'Success']);
        exit;
    }

    $step = (int)($input['_step'] ?? 0);
    if ($step < 1 || $step > 6) {
        http_response_code(400);
        echo json_encode(['status' => false, 'message' => 'Invalid step']);
        exit;
    }

    // Remove internal fields before forwarding to EMAP
    unset($input['_csrf'], $input['_hp'], $input['_step']);

    // ── Step 1: ExternalSignupRequest ─────────────────────────────────────────
    if ($step === 1) {
        $firstName         = trim((string)($input['first_name']        ?? ''));
        $lastName          = trim((string)($input['last_name']         ?? ''));
        $email             = trim((string)($input['email']             ?? ''));
        $phone             = trim((string)($input['phone']             ?? ''));
        $name              = trim((string)($input['name'] ?? $input['company_name'] ?? ''));
        $website           = trim((string)($input['website']           ?? ''));
        $country           = strtoupper(trim((string)($input['country'] ?? '')));
        $annualSales       = (float)($input['annual_sales'] ?? 0);
        $industryType      = trim((string)($input['industry_type']      ?? ''));
        $industryTypeOther = trim((string)($input['industry_type_other'] ?? ''));

        $missing = [];
        if (!$firstName)      $missing['first_name']    = ['First name is required'];
        if (!$lastName)       $missing['last_name']     = ['Last name is required'];
        if (!$email)          $missing['email']         = ['Email is required'];
        if (!$phone)          $missing['phone']         = ['Phone is required'];
        if (!$name)           $missing['name']          = ['Company name is required'];
        if (!$website)        $missing['website']       = ['Website is required'];
        if (!$country)        $missing['country']       = ['Country is required'];
        if ($annualSales < 1) $missing['annual_sales']  = ['Annual sales must be at least 1'];
        if (!$industryType)   $missing['industry_type'] = ['Industry type is required'];

        if (!empty($missing)) {
            http_response_code(422);
            echo json_encode(['status' => false, 'message' => 'Validation failed', 'errors' => $missing]);
            exit;
        }

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

        $bizState  = strtoupper(trim((string)($input['business_state'] ?? '')));
        $promoCode = trim((string)($input['promo_code'] ?? ''));

        if ($bizState)          $payload['business_state']      = $bizState;
        if ($industryTypeOther) $payload['industry_type_other'] = $industryTypeOther;
        if ($promoCode)         $payload['promo_code']          = $promoCode;
        if ($emapPartnerKey)    $payload['partner_key']        = $emapPartnerKey;

        $result = emapPost($emapOrigin . '/api/v1/signup', $payload);
        http_response_code($result['status_code']);
        echo json_encode($result['body']);
        exit;
    }

    // ── Steps 2, 3, 5, 6: ApplicationStepRequest ─────────────────────────────
    if (in_array($step, [2, 3, 5, 6], true)) {
        $uuid = trim((string)($input['uuid'] ?? ''));
        if (!$uuid) {
            http_response_code(422);
            echo json_encode(['status' => false, 'message' => 'uuid is required']);
            exit;
        }

        // Step 2: EIN format validation only for US companies
        if ($step === 2) {
            $ein     = trim((string)($input['federal_tax_id'] ?? ''));
            $addrCtry = strtoupper(trim((string)($input['address_country'] ?? '')));
            $isUS    = ($addrCtry === 'US' || $addrCtry === '');
            if ($ein !== '' && $isUS && !preg_match('/^\d{2}-\d{7}$/', $ein)) {
                http_response_code(422);
                echo json_encode([
                    'status'  => false,
                    'message' => 'Validation failed',
                    'errors'  => ['federal_tax_id' => ['EIN must be in the format XX-XXXXXXX (e.g. 12-3456789)']],
                ]);
                exit;
            }
        }

        $input['step_count'] = $step;
        $result = emapPost($emapOrigin . '/api/v1/application/step', $input);
        http_response_code($result['status_code']);
        echo json_encode($result['body']);
        exit;
    }

    // ── Step 4: HandleOwnershipRequest ────────────────────────────────────────
    if ($step === 4) {
        $uuid = trim((string)($input['uuid'] ?? ''));
        if (!$uuid) {
            http_response_code(422);
            echo json_encode(['status' => false, 'message' => 'uuid is required']);
            exit;
        }

        // SSN / Tax ID validation — format only enforced for US and CA
        $ssnErrors = [];
        $ssnFields  = $input['ssn'] ?? [];
        $countryFields = $input['country'] ?? [];
        if (is_array($ssnFields)) {
            foreach (['1', '2'] as $n) {
                if (isset($ssnFields[$n])) {
                    $val     = trim((string)$ssnFields[$n]);
                    $country = strtoupper(trim((string)($countryFields[$n] ?? '')));
                    $needsFmt = ($country === 'US' || $country === 'CA' || $country === '');
                    if ($val === '') {
                        $ssnErrors['ssn.' . $n] = ['SSN / Tax ID is required'];
                    } elseif ($needsFmt && !preg_match('/^\d{3}-\d{2}-\d{4}$/', $val)) {
                        $ssnErrors['ssn.' . $n] = ['SSN must be in the format XXX-XX-XXXX (e.g. 123-45-6789)'];
                    }
                }
            }
        }
        if (!empty($ssnErrors)) {
            http_response_code(422);
            echo json_encode(['status' => false, 'message' => 'Validation failed', 'errors' => $ssnErrors]);
            exit;
        }

        $result = emapPost($emapOrigin . '/api/v1/ownership', $input);
        http_response_code($result['status_code']);
        echo json_encode($result['body']);
        exit;
    }
}

// ── Helper: POST to EMAP via cURL ─────────────────────────────────────────────
function emapPost(string $url, array $payload): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $responseBody = curl_exec($ch);
    $statusCode   = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError    = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        error_log('[EMAP] cURL error: ' . $curlError);
        return [
            'status_code' => 502,
            'body'        => ['status' => false, 'message' => 'EMAP is temporarily unavailable. Please try again.'],
        ];
    }

    if ($statusCode >= 500) {
        error_log('[EMAP] HTTP ' . $statusCode . ' from ' . $url);
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

// ── GET: serve the form ───────────────────────────────────────────────────────
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');

// Serve plain-html.html from the same directory, injecting the CSRF token.
// The HTML form must POST to this PHP file with _csrf and _step fields.
$htmlFile = __DIR__ . '/plain-html.html';
if (!file_exists($htmlFile)) {
    http_response_code(500);
    die('plain-html.html not found in the same directory');
}

// Inject CSRF token into the HTML before serving
$html = file_get_contents($htmlFile);
$html = str_replace(
    '<!-- PHP_CSRF_TOKEN -->',
    '<input type="hidden" id="php_csrf_token" value="' . htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') . '">',
    $html
);
echo $html;
