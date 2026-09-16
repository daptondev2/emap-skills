/**
 * EMAP Partner Integration 3 — Email-Based Signup (Express.js)
 *
 * The partner fills in the merchant's step-1 details and submits.
 * This server proxies the data to EMAP /api/v1/signup, which creates the account
 * and emails the merchant a secure link to complete their full application on
 * Easy Pay Direct's platform.
 *
 * Install:  npm install express dotenv node-fetch@2
 *
 * .env file:
 *   EMAP_BASE_URL=https://emap.epd.dev
 *   EMAP_PARTNER_KEY=your_partner_key_here    # never commit this
 *   PORT=3000
 *
 * Run: node node-express.js
 *
 * Endpoints:
 *   POST /api/signup              — proxy to EMAP /api/v1/signup; EMAP emails merchant a signup link
 *   POST /api/signup/resume-link  — resend the signup link to a merchant email
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

// ── Regex constants ───────────────────────────────────────────────────────────
const PHONE_RE   = /^[0-9+\-()\s]+$/;
const WEBSITE_RE = /^(https?:\/\/)?[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/;
const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const VALID_US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]);

// ── Validation helpers ────────────────────────────────────────────────────────
function validateSignupPayload(body) {
  const errors = {};

  const firstName = body.first_name?.trim() ?? '';
  if (!firstName)                errors.first_name = ['First name is required'];
  else if (firstName.length > 60) errors.first_name = ['First name must be 60 characters or fewer'];

  const lastName = body.last_name?.trim() ?? '';
  if (!lastName)                 errors.last_name  = ['Last name is required'];
  else if (lastName.length > 60) errors.last_name  = ['Last name must be 60 characters or fewer'];

  const email = body.email?.trim() ?? '';
  if (!email)                           errors.email = ['Email is required'];
  else if (!EMAIL_RE.test(email))       errors.email = ['A valid email address is required'];

  const phone = body.phone?.trim() ?? '';
  if (!phone)                           errors.phone = ['Phone is required'];
  else if (phone.length > 20)           errors.phone = ['Phone must be 20 characters or fewer'];
  else if (!PHONE_RE.test(phone))       errors.phone = ['Phone may only contain digits, +, -, (, ), and spaces'];

  const name = (body.name || body.company_name || '').trim();
  if (!name)                            errors.name = ['Company name is required'];
  else if (name.length > 60)            errors.name = ['Company name must be 60 characters or fewer'];

  const website = body.website?.trim() ?? '';
  if (!website)                         errors.website = ['Website is required'];
  else if (!WEBSITE_RE.test(website))   errors.website = ['Website must be a valid URL (e.g. https://yourcompany.com)'];

  const country = body.country?.trim().toUpperCase() ?? '';
  if (!country)                         errors.country = ['Country is required'];
  else if (country.length !== 2)        errors.country = ['Country must be a 2-character ISO code (e.g. US, CA)'];

  const sales = Number(body.annual_sales);
  if (!body.annual_sales || isNaN(sales) || sales < 1)
                                        errors.annual_sales = ['Annual sales must be at least 1'];
  else if (sales > 999999999999)        errors.annual_sales = ['Annual sales value is too large'];

  if (country === 'US') {
    const state = body.business_state?.trim().toUpperCase() ?? '';
    if (!state)                         errors.business_state = ['State is required for US businesses'];
    else if (!VALID_US_STATES.has(state)) errors.business_state = ['Must be a valid 2-character US state code (e.g. CA, TX)'];
  }

  const industryType = body.industry_type?.trim() ?? '';
  if (!industryType) errors.industry_type = ['Industry type is required'];

  return errors;
}

// ── GET /api/countries ────────────────────────────────────────────────────────
// Proxy EMAP's public country list — safe to cache; no auth required.
app.get('/api/countries', async function (req, res) {
  try {
    const response = await fetch(`${emapOrigin}/api/partner/countries`, {
      headers: { 'Accept': 'application/json' },
    });
    const data = await response.json();
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json(data);
  } catch (_) {
    return res.status(502).json({ data: [] });
  }
});

// ── GET /api/industry-types ───────────────────────────────────────────────────
// Proxy EMAP's industry type list — safe to cache; no auth required.
app.get('/api/industry-types', async function (req, res) {
  try {
    const response = await fetch(`${emapOrigin}/api/partner/industry-types`, {
      headers: { 'Accept': 'application/json' },
    });
    const data = await response.json();
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json(data);
  } catch (_) {
    return res.status(502).json({ data: [] });
  }
});

// ── POST /api/signup ──────────────────────────────────────────────────────────
// Proxy to EMAP's external signup API.
app.post('/api/signup', async function (req, res) {
  // Honeypot — real users never fill this hidden field; bots often do.
  // Reject silently (fake success, no EMAP call) so the bot has no signal to adapt to.
  if (req.body._hp) {
    return res.status(200).json({ status: true, message: 'Success', uuid: '' });
  }

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
    website, country, annual_sales, business_state, industry_type, industry_type_other, promo_code,
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

  if (business_state)      payload.business_state      = business_state.trim().toUpperCase();
  payload.industry_type = industry_type.trim();
  if (industry_type_other) payload.industry_type_other = industry_type_other.trim();
  if (promo_code)          payload.promo_code          = promo_code.trim();

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
