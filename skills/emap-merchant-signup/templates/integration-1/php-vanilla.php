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

// ── .env loader ──────────────────────────────────────────────────────────────
// PHP has no built-in dotenv support (unlike node-express.js's `require('dotenv').config()`),
// so a .env file dropped next to this script is never read on its own. If one exists in
// __DIR__, parse it line-by-line and populate $_ENV / putenv() so getenv() below picks it
// up. Missing .env is fine — env vars may instead be set via the server/Apache config.
function loadDotEnv(string $path): void
{
    if (!is_readable($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        $eqPos = strpos($line, '=');
        if ($eqPos === false) {
            continue;
        }
        $name  = trim(substr($line, 0, $eqPos));
        $value = trim(substr($line, $eqPos + 1));
        if ($name === '') {
            continue;
        }
        // Strip a single pair of matching surrounding quotes, if present.
        if (strlen($value) >= 2) {
            $first = $value[0];
            $last  = $value[strlen($value) - 1];
            if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                $value = substr($value, 1, -1);
            }
        }
        // Don't clobber values already set in the real environment.
        if (getenv($name) === false && !isset($_ENV[$name])) {
            putenv($name . '=' . $value);
            $_ENV[$name] = $value;
        }
    }
}
loadDotEnv(__DIR__ . '/.env');

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

// Maps dropdown-proxy keys above (hyphenated) to the corresponding key in
// dropdown-fallbacks.json (underscored), mirroring node-express.js's FALLBACK_KEY_BY_PATH.
$dropdownFallbackKeyMap = [
    'countries'        => 'countries',
    'states'           => 'states',
    'industry-types'   => 'industry_types',
    'shopping-carts'   => 'shopping_carts',
    'referral-sources' => 'referral_sources',
    'interest-details' => 'interest_details',
];

// Loads and caches references/dropdown-fallbacks.json (static snapshot of EMAP's
// /api/partner/* dropdown endpoints), used only when the live EMAP call fails or
// returns no usable options — mirrors node-express.js's DROPDOWN_FALLBACKS.
//
// NOTE: a copy of dropdown-fallbacks.json must be deployed alongside this file
// (i.e. next to index.php) at __DIR__ . '/dropdown-fallbacks.json' — same as the
// skill's SKILL.md already documents for other reference files copied during a build.
function getDropdownFallback(string $fallbackKey): array
{
    static $fallbacks = null;
    if ($fallbacks === null) {
        $fallbacks = [];
        $path = __DIR__ . '/dropdown-fallbacks.json';
        if (is_readable($path)) {
            $raw     = file_get_contents($path);
            $decoded = $raw !== false ? json_decode($raw, true) : null;
            if (is_array($decoded)) {
                $fallbacks = $decoded;
            }
        }
    }
    return $fallbacks[$fallbackKey] ?? ['data' => []];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['_dropdown'])) {
    $key = (string)$_GET['_dropdown'];
    if (!isset($dropdownMap[$key])) {
        http_response_code(400);
        echo json_encode(['data' => []]);
        exit;
    }
    header('Content-Type: application/json; charset=utf-8');

    $ch = curl_init($emapOrigin . $dropdownMap[$key]);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $body       = curl_exec($ch);
    $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError  = curl_error($ch);
    curl_close($ch);

    $decoded  = ($body !== false && $body !== '') ? json_decode($body, true) : null;
    $isUsable = !$curlError
        && $statusCode >= 200 && $statusCode < 300
        && is_array($decoded)
        && isset($decoded['data'])
        && is_array($decoded['data'])
        && count($decoded['data']) > 0;

    if ($isUsable) {
        header('Cache-Control: public, max-age=3600');
        echo json_encode($decoded);
        exit;
    }

    if ($curlError) {
        error_log('[EMAP] Dropdown proxy cURL error for ' . $key . ': ' . $curlError);
    } else {
        error_log('[EMAP] Dropdown proxy: EMAP ' . $key . ' returned unusable data (status ' . $statusCode . '); serving fallback.');
    }

    // Live call failed or returned no usable options — serve the static fallback
    // snapshot instead of an empty dropdown, with a normal 200 status. Do not cache this.
    header('Cache-Control: no-store');
    echo json_encode(getDropdownFallback($dropdownFallbackKeyMap[$key] ?? $key));
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

        // Step 2: federal_tax_id / business_register_number validation.
        // country_from_step1 is sent by the client for this check only (the
        // Step 1 formation country — NOT address_country, a separate Step 2
        // legal-address field); it is never forwarded to EMAP (stripped below).
        if ($step === 2) {
            $country = strtoupper(trim((string)($input['country_from_step1'] ?? '')));
            $businessOrganized = trim((string)($input['business_organized'] ?? ''));
            $isSoleProp = $businessOrganized === 'Sole-Proprietorship';
            $errors = [];

            // federal_tax_id: required unless country=CA OR org=Sole-Proprietorship (OR —
            // matches manageFederalTaxId in EMAP's own variantA/step2 js.blade.php; the
            // schema's visibleIf.logic uses AND instead and is stale/wrong — see SKILL.md).
            $einRequired = !($country === 'CA' || $isSoleProp);
            $ein = trim((string)($input['federal_tax_id'] ?? ''));
            if ($einRequired) {
                if ($ein === '') {
                    $errors['federal_tax_id'] = ['Tax ID is required'];
                } else {
                    // US/CA/PR: XXX-XX-XXXX (3-2-4); every other country: XX-XXXXXXX (2-7) —
                    // matches Cleave.js formatConfig in manageFederalTaxIdFormat exactly.
                    $isUsCaPr = in_array($country, ['US', 'CA', 'PR'], true);
                    $einPattern = $isUsCaPr ? '/^\d{3}-\d{2}-\d{4}$/' : '/^\d{2}-\d{7}$/';
                    if (!preg_match($einPattern, $ein)) {
                        $errors['federal_tax_id'] = [$isUsCaPr
                            ? 'Tax ID must be in the format XXX-XX-XXXX (e.g. 123-45-6789)'
                            : 'Tax ID must be in the format XX-XXXXXXX (e.g. 12-3456789)'];
                    }
                }
            }

            // business_register_number: required unless country=US, country=PR, OR
            // (country=CA AND org=Sole-Proprietorship) — matches
            // manageBusinessRegistrationNumber exactly (not just "non-US").
            $regRequired = !($country === 'US' || $country === 'PR' || ($country === 'CA' && $isSoleProp));
            $regNumber = trim((string)($input['business_register_number'] ?? ''));
            if ($regRequired && $regNumber === '') {
                $errors['business_register_number'] = ['Business registration number is required'];
            }

            if (!empty($errors)) {
                http_response_code(422);
                echo json_encode([
                    'status'  => false,
                    'message' => 'Validation failed',
                    'errors'  => $errors,
                ]);
                exit;
            }

            unset($input['country_from_step1']);
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

        // SSN / SIN validation — format keyed off country_from_step1 (the single
        // Step 1 formation country, sent by the client for this check only and
        // never forwarded to EMAP), applied identically to BOTH owners. NOT each
        // owner's own country.1/country.2 (home address/residence — a separate
        // field used only for driver's license gating). Matches EMAP's own
        // variantA/step4 js.blade.php exactly: selectedCountry = $company->country
        // drives both owner_ssn Cleave masks and validateSSN() there.
        $errors = [];
        $ssnFields = $input['ssn'] ?? [];
        $ssnCountry = strtoupper(trim((string)($input['country_from_step1'] ?? '')));
        $needsFmt = in_array($ssnCountry, ['US', 'CA', 'PR'], true);
        if (is_array($ssnFields)) {
            foreach (['1', '2'] as $n) {
                if (isset($ssnFields[$n])) {
                    $val = trim((string)$ssnFields[$n]);
                    if ($val === '') {
                        $errors['ssn.' . $n] = ['SSN/SIN is required'];
                    } elseif ($needsFmt && !preg_match('/^\d{3}-\d{2}-\d{4}$/', $val)) {
                        $errors['ssn.' . $n] = ['SSN/SIN must be in the format XXX-XX-XXXX (e.g. 123-45-6789)'];
                    }
                }
            }
        }

        // DOB — owner must be between 18 and 100 years old (nested as dob[1], dob[2]),
        // mirroring node-express.js's /api/step/4 DOB check.
        $dobFields = $input['dob'] ?? [];
        if (is_array($dobFields)) {
            foreach (['1', '2'] as $n) {
                if (isset($dobFields[$n]) && $dobFields[$n] !== '') {
                    $age = emapAgeFromDob((string)$dobFields[$n]);
                    if ($age === null) {
                        $errors['dob.' . $n] = ['Date of birth is invalid'];
                    } elseif ($age < 18) {
                        $errors['dob.' . $n] = ['Owner must be at least 18 years old'];
                    } elseif ($age > 100) {
                        $errors['dob.' . $n] = ['Please enter a valid date of birth'];
                    }
                }
            }
        }

        if (!empty($errors)) {
            http_response_code(422);
            echo json_encode(['status' => false, 'message' => 'Validation failed', 'errors' => $errors]);
            exit;
        }

        unset($input['country_from_step1']);
        $result = emapPost($emapOrigin . '/api/v1/ownership', $input);
        http_response_code($result['status_code']);
        echo json_encode($result['body']);
        exit;
    }
}

// ── Helper: compute age in years from a submitted DOB string ──────────────────
// Mirrors node-express.js's /api/step/4 DOB check: ageYears = (now - dob) / 365.25 days.
// Returns null if the date string cannot be parsed.
function emapAgeFromDob(string $value): ?float
{
    $value = trim($value);
    if ($value === '') {
        return null;
    }
    $timestamp = strtotime($value);
    if ($timestamp === false) {
        return null;
    }
    $seconds = time() - $timestamp;
    return $seconds / (365.25 * 24 * 60 * 60);
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
