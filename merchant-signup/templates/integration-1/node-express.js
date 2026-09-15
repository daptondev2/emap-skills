/**
 * EMAP Partner Integration 1 — Full 6-Step Form (Express.js backend)
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
 * Endpoints — dropdown data (public, cached):
 *   GET  /api/countries          → EMAP /api/partner/countries
 *   GET  /api/states             → EMAP /api/partner/states
 *   GET  /api/industry-types     → EMAP /api/partner/industry-types
 *   GET  /api/shopping-carts     → EMAP /api/partner/shopping-carts
 *   GET  /api/referral-sources   → EMAP /api/partner/referral-sources
 *   GET  /api/interest-details   → EMAP /api/partner/interest-details
 *
 * Endpoints — form steps (proxy to EMAP, partner_key injected server-side):
 *   POST /api/step/1             → EMAP POST /api/v1/signup
 *   POST /api/step/2             → EMAP POST /api/v1/application/step (step_count=2)
 *   POST /api/step/3             → EMAP POST /api/v1/application/step (step_count=3)
 *   POST /api/step/4             → EMAP POST /api/v1/ownership
 *   POST /api/step/5             → EMAP POST /api/v1/application/step (step_count=5)
 *   POST /api/step/6             → EMAP POST /api/v1/application/step (step_count=6)
 */

'use strict';
require('dotenv').config();

const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');
const app     = express();

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

let emapOrigin;
try {
  emapOrigin = new URL(EMAP_BASE_URL).origin;
} catch {
  throw new Error('EMAP_BASE_URL is not a valid URL');
}

// ── Dropdown proxy helpers ────────────────────────────────────────────────────
function dropdownProxy(emapPath) {
  return async function (req, res) {
    try {
      const response = await fetch(`${emapOrigin}${emapPath}`, {
        headers: { 'Accept': 'application/json' },
      });
      const data = await response.json();
      res.set('Cache-Control', 'public, max-age=3600');
      return res.json(data);
    } catch (_) {
      return res.status(502).json({ data: [] });
    }
  };
}

app.get('/api/countries',        dropdownProxy('/api/partner/countries'));
app.get('/api/states',           dropdownProxy('/api/partner/states'));
app.get('/api/industry-types',   dropdownProxy('/api/partner/industry-types'));
app.get('/api/shopping-carts',   dropdownProxy('/api/partner/shopping-carts'));
app.get('/api/referral-sources', dropdownProxy('/api/partner/referral-sources'));
app.get('/api/interest-details', dropdownProxy('/api/partner/interest-details'));

// ── Step proxy helper ─────────────────────────────────────────────────────────
async function proxyStep(emapPath, body, res) {
  let emapResponse, emapData;
  try {
    emapResponse = await fetch(`${emapOrigin}${emapPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    });
    emapData = await emapResponse.json();
  } catch (networkError) {
    console.error('EMAP network error:', networkError.message);
    return res.status(502).json({
      status: false,
      message: 'EMAP is temporarily unavailable. Please try again.',
    });
  }

  if (emapResponse.status === 429) {
    return res.status(429).json({
      status: false,
      message: 'Too many requests. Please wait a few minutes and try again.',
    });
  }

  if (emapResponse.status >= 500) {
    console.error('EMAP API returned', emapResponse.status, 'for', emapPath);
    return res.status(502).json({
      status: false,
      message: 'EMAP is temporarily unavailable. Please try again.',
    });
  }

  return res.status(emapResponse.status).json(emapData);
}

// ── POST /api/step/1 ─── ExternalSignupRequest ───────────────────────────────
app.post('/api/step/1', async function (req, res) {
  const {
    first_name, last_name, email, phone,
    name, company_name,
    website, country, annual_sales, business_state,
    industry_type, promo_code,
  } = req.body;

  // Basic server-side guard — EMAP validates fully; we just reject obviously empty calls
  const required = { first_name, last_name, email, phone, website, country, annual_sales };
  const companyName = (name || company_name || '').trim();
  if (!companyName) required.name = '';

  const missing = Object.entries(required)
    .filter(([, v]) => !v || String(v).trim() === '')
    .map(([k]) => k);

  if (missing.length > 0) {
    const errors = {};
    missing.forEach(function (k) { errors[k] = [k.replace(/_/g, ' ') + ' is required']; });
    return res.status(422).json({ status: false, message: 'Validation failed', errors });
  }

  const payload = {
    first_name:   String(first_name).trim(),
    last_name:    String(last_name).trim(),
    email:        String(email).trim().toLowerCase(),
    phone:        String(phone).trim(),
    name:         companyName,
    website:      String(website).trim(),
    country:      String(country).trim().toUpperCase(),
    annual_sales: Number(annual_sales),
  };

  if (business_state)  payload.business_state  = String(business_state).trim().toUpperCase();
  if (industry_type)   payload.industry_type   = String(industry_type).trim();
  if (promo_code)      payload.promo_code       = String(promo_code).trim();

  // Partner key from env only — never from the request body
  if (process.env.EMAP_PARTNER_KEY) payload.partner_key = process.env.EMAP_PARTNER_KEY;

  return proxyStep('/api/v1/signup', payload, res);
});

// ── POST /api/step/2 ─── ApplicationStepRequest (step_count=2) ───────────────
app.post('/api/step/2', async function (req, res) {
  const { uuid } = req.body;
  if (!uuid) return res.status(422).json({ status: false, message: 'uuid is required' });

  // EIN format — only present when the EIN group is visible (non-CA-sole-prop businesses)
  const ein = String(req.body.federal_tax_id || '').trim();
  if (ein && !/^\d{2}-\d{7}$/.test(ein)) {
    return res.status(422).json({
      status: false, message: 'Validation failed',
      errors: { federal_tax_id: ['EIN must be in the format XX-XXXXXXX (e.g. 12-3456789)'] },
    });
  }

  const payload = Object.assign({}, req.body, { step_count: 2 });
  return proxyStep('/api/v1/application/step', payload, res);
});

// ── POST /api/step/3 ─── ApplicationStepRequest (step_count=3) ───────────────
app.post('/api/step/3', async function (req, res) {
  const { uuid } = req.body;
  if (!uuid) return res.status(422).json({ status: false, message: 'uuid is required' });

  const payload = Object.assign({}, req.body, { step_count: 3 });
  return proxyStep('/api/v1/application/step', payload, res);
});

// ── POST /api/step/4 ─── HandleOwnershipRequest ───────────────────────────────
app.post('/api/step/4', async function (req, res) {
  const { uuid } = req.body;
  if (!uuid) return res.status(422).json({ status: false, message: 'uuid is required' });

  // SSN format — nested as { ssn: { '1': '...', '2': '...' } } from the client toNestedDot helper
  const SSN_RE = /^\d{3}-\d{2}-\d{4}$/;
  const ssnObj = req.body.ssn || {};
  const errors = {};

  ['1', '2'].forEach(function (n) {
    if (ssnObj[n] !== undefined) {
      const val = String(ssnObj[n]).trim();
      if (!val) {
        errors['ssn.' + n] = ['SSN / Tax ID is required'];
      } else if (!SSN_RE.test(val)) {
        errors['ssn.' + n] = ['SSN must be in the format XXX-XX-XXXX (e.g. 123-45-6789)'];
      }
    }
  });

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ status: false, message: 'Validation failed', errors });
  }

  return proxyStep('/api/v1/ownership', req.body, res);
});

// ── POST /api/step/5 ─── ApplicationStepRequest (step_count=5) ───────────────
app.post('/api/step/5', async function (req, res) {
  const { uuid } = req.body;
  if (!uuid) return res.status(422).json({ status: false, message: 'uuid is required' });

  const payload = Object.assign({}, req.body, { step_count: 5 });
  return proxyStep('/api/v1/application/step', payload, res);
});

// ── POST /api/step/6 ─── ApplicationStepRequest (step_count=6) ───────────────
app.post('/api/step/6', async function (req, res) {
  const { uuid } = req.body;
  if (!uuid) return res.status(422).json({ status: false, message: 'uuid is required' });

  const payload = Object.assign({}, req.body, { step_count: 6 });
  return proxyStep('/api/v1/application/step', payload, res);
});

// ── Serve the form ────────────────────────────────────────────────────────────
app.get('/', function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'plain-html.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('EMAP Integration 1 server listening on port ' + PORT);
  console.log('EMAP origin:', emapOrigin);
  if (!process.env.EMAP_PARTNER_KEY) {
    console.warn('EMAP_PARTNER_KEY not set — signups will not be attributed to a partner');
  }
});
