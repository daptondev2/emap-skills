/**
 * EMAP Partner Integration 3 — API Submission (Express.js)
 *
 * Install:  npm install express dotenv node-fetch@2
 *
 * .env file:
 *   EMAP_BASE_URL=https://app.easypaydirect.com
 *   EMAP_PARTNER_KEY=your_partner_key_here    # never commit this
 *   PORT=3000
 *
 * Run: node node-express.js
 *
 * Endpoints:
 *   POST /api/signup              — proxy to EMAP /api/v1/signup
 *   POST /api/signup/resume-link  — proxy to EMAP /api/v1/signup/resume-link
 */

'use strict';
require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Security headers ─────────────────────────────────────────────────────────
app.use(function (req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// ── Config ───────────────────────────────────────────────────────────────────
const EMAP_BASE_URL = process.env.EMAP_BASE_URL;
if (!EMAP_BASE_URL) throw new Error('EMAP_BASE_URL environment variable is required');

// Validate base URL at startup to prevent open-redirect if someone modifies .env
let emapOrigin;
try {
  emapOrigin = new URL(EMAP_BASE_URL).origin;
} catch {
  throw new Error('EMAP_BASE_URL is not a valid URL');
}

// ── Validation helpers ────────────────────────────────────────────────────────
function validateSignupPayload(body) {
  const errors = {};

  if (!body.first_name?.trim())   errors.first_name   = ['First name is required'];
  if (!body.last_name?.trim())    errors.last_name    = ['Last name is required'];

  const email = body.email?.trim() ?? '';
  if (!email) {
    errors.email = ['Email is required'];
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = ['A valid email address is required'];
  }

  if (!body.phone?.trim())        errors.phone        = ['Phone is required'];
  if (!body.name?.trim())         errors.name         = ['Company name is required'];
  if (!body.website?.trim())      errors.website      = ['Website is required'];
  if (!body.country?.trim())      errors.country      = ['Country is required'];

  const sales = Number(body.annual_sales);
  if (!body.annual_sales || isNaN(sales) || sales < 1) {
    errors.annual_sales = ['Annual sales must be a positive number (in USD)'];
  }

  if (String(body.country).toUpperCase() === 'US' && !body.business_state?.trim()) {
    errors.business_state = ['State is required for US businesses'];
  }

  return errors;
}

// ── POST /api/signup ──────────────────────────────────────────────────────────
// Proxy to EMAP's external signup API.
app.post('/api/signup', async function (req, res) {
  // Validate server-side before touching EMAP
  const validationErrors = validateSignupPayload(req.body);
  if (Object.keys(validationErrors).length > 0) {
    return res.status(422).json({
      status: false,
      message: 'Validation failed',
      errors: validationErrors,
    });
  }

  // Build the payload — only forward known fields; ignore everything else
  const {
    first_name, last_name, email, phone,
    name,           // company name — EMAP expects 'name', not 'company_name'
    company_name,   // HTML form may send 'company_name'; map it to 'name' below
    website, country, annual_sales, business_state, promo_code,
  } = req.body;

  const payload = {
    first_name:   first_name.trim(),
    last_name:    last_name.trim(),
    email:        email.trim().toLowerCase(),
    phone:        phone.trim(),
    name:         (name || company_name || '').trim(),   // accept either field name
    website:      website.trim(),
    country:      country.trim().toUpperCase(),
    annual_sales: Number(annual_sales),
  };

  if (business_state) payload.business_state = business_state.trim().toUpperCase();
  if (promo_code)     payload.promo_code = promo_code.trim();

  // Add partner key from env — never from the request body
  if (process.env.EMAP_PARTNER_KEY) {
    payload.partner_key = process.env.EMAP_PARTNER_KEY;
  }

  let emapResponse;
  let emapData;

  try {
    emapResponse = await fetch(`${emapOrigin}/api/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // Never log the body — it contains PII
      body: JSON.stringify(payload),
    });

    emapData = await emapResponse.json();
  } catch (networkError) {
    // Don't log the payload; log only the error message
    console.error('EMAP API network error:', networkError.message);
    return res.status(502).json({
      status: false,
      message: 'EMAP is temporarily unavailable. Please try again in a few minutes.',
    });
  }

  // Rate limit from EMAP — surface a friendly message
  if (emapResponse.status === 429) {
    return res.status(429).json({
      status: false,
      message: 'Too many requests. Please wait a few minutes and try again.',
    });
  }

  // Validation error from EMAP — pass through (can happen for edge cases like email already taken)
  if (emapResponse.status === 422) {
    return res.status(422).json(emapData);
  }

  // EMAP server error
  if (emapResponse.status >= 500) {
    console.error('EMAP API returned', emapResponse.status);
    return res.status(502).json({
      status: false,
      message: 'EMAP is temporarily unavailable. Please try again in a few minutes.',
    });
  }

  // All other responses (200 — success, existing user, company exists) pass through as-is
  return res.status(emapResponse.status).json(emapData);
});

// ── POST /api/signup/resume-link ──────────────────────────────────────────────
// Proxy to EMAP's resume-link endpoint.
// Always returns the same response body (200) to prevent email enumeration.
app.post('/api/signup/resume-link', async function (req, res) {
  const email = req.body.email?.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({
      status: false,
      message: 'A valid email address is required',
    });
  }

  try {
    const emapResponse = await fetch(`${emapOrigin}/api/v1/signup/resume-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await emapResponse.json();

    if (emapResponse.status === 429) {
      return res.status(429).json({
        status: false,
        message: 'Too many resume link requests. Please try again in a few minutes.',
      });
    }

    return res.status(emapResponse.status).json(data);
  } catch (networkError) {
    console.error('EMAP resume-link error:', networkError.message);
    return res.status(502).json({
      status: false,
      message: 'Could not send the resume link. Please try again.',
    });
  }
});

// ── Serve the HTML form ───────────────────────────────────────────────────────
app.get('/', function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'plain-html.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('EMAP partner signup server listening on port ' + PORT);
  console.log('EMAP origin:', emapOrigin);
  if (!process.env.EMAP_PARTNER_KEY) {
    console.warn('EMAP_PARTNER_KEY not set — signups will not be attributed to a partner');
  }
});
