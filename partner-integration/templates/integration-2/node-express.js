/**
 * EMAP Partner Integration 2 — Redirect Handoff (Express.js)
 *
 * Install:  npm install express dotenv
 *
 * .env file:
 *   EMAP_BASE_URL=https://app.easypaydirect.com
 *   EMAP_PARTNER_SECRET_KEY=your_key_here     # optional; enables partner attribution
 *   PORT=3000
 *
 * Run: node node-express.js
 *
 * Flow:
 *   1. Browser submits form to POST /api/build-redirect
 *   2. This server validates fields, builds the signed redirect URL, returns it as JSON
 *   3. Browser follows the URL → EMAP prefills form → auto-saves or auto-submits
 */

'use strict';
require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Security headers ─────────────────────────────────────────────────────────
app.use(function (req, res, next) {
  // Prevent the EMAP URL (with PII in query string) leaking via Referer header
  res.setHeader('Referrer-Policy', 'no-referrer');
  // Don't cache pages that contain PII
  res.setHeader('Cache-Control', 'no-store');
  // Clickjacking protection
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// ── Config ───────────────────────────────────────────────────────────────────
const EMAP_BASE_URL = process.env.EMAP_BASE_URL;
if (!EMAP_BASE_URL) {
  throw new Error('EMAP_BASE_URL environment variable is required');
}

// Allowed URL params — whitelist to prevent open redirect injection
const ALLOWED_FORM_FIELDS = [
  'first_name', 'last_name', 'email', 'phone', 'company_name', 'website',
  'country', 'annual_sales', 'business_state', 'promo_code',
  'highest_transaction_amount', 'industry_type', 'card_swiped', 'customer_entered',
  'staff_entered', 'current_processing', 'expected_monthly_volume',
];

const TRACKING_FIELDS = [
  'utm_campaign', 'utm_source', 'utm_medium', 'utm_term', 'utm_content',
  'gclid', 'gbraid', 'wbraid',
];

// ── Validation ───────────────────────────────────────────────────────────────
function validateSignupFields(body) {
  const errors = {};

  if (!body.first_name?.trim())   errors.first_name   = 'First name is required';
  if (!body.last_name?.trim())    errors.last_name    = 'Last name is required';

  const email = body.email?.trim() ?? '';
  if (!email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'A valid email address is required';
  }

  if (!body.phone?.trim())        errors.phone        = 'Phone is required';
  if (!body.company_name?.trim()) errors.company_name = 'Company name is required';
  if (!body.website?.trim())      errors.website      = 'Website is required';
  if (!body.country?.trim())      errors.country      = 'Country is required';

  const sales = Number(body.annual_sales);
  if (!body.annual_sales || isNaN(sales) || sales < 1) {
    errors.annual_sales = 'Annual sales must be a positive number';
  }

  if (body.country === 'US' && !body.business_state?.trim()) {
    errors.business_state = 'State is required for US businesses';
  }

  return errors;
}

// ── POST /api/build-redirect ─────────────────────────────────────────────────
// Validates fields, builds the EMAP redirect URL, and returns it to the client.
app.post('/api/build-redirect', function (req, res) {
  const errors = validateSignupFields(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ status: false, errors });
  }

  const params = new URLSearchParams();

  // Add whitelisted form fields
  ALLOWED_FORM_FIELDS.forEach(function (field) {
    const value = req.body[field];
    if (value != null && String(value).trim() !== '') {
      params.set(field, String(value).trim());
    }
  });

  // marketing_model is an array (e.g. from checkboxes with name="marketing_model[]")
  const marketingModels = req.body['marketing_model[]'] || req.body.marketing_model;
  if (marketingModels) {
    const models = Array.isArray(marketingModels) ? marketingModels : [marketingModels];
    models.forEach(function (v) {
      if (v) params.append('marketing_model[]', v);
    });
  }

  // Pass through UTM/click tracking from the incoming request
  TRACKING_FIELDS.forEach(function (field) {
    const value = req.body[field] || req.query[field];
    if (value) params.set(field, value);
  });

  // Partner attribution — always from env, never from the incoming request body
  const partnerKey = process.env.EMAP_PARTNER_SECRET_KEY;
  if (partnerKey) {
    params.set('secretKey', partnerKey);
  }

  // Validate the base URL to prevent open redirect
  let redirectUrl;
  try {
    const base = new URL(EMAP_BASE_URL);
    redirectUrl = `${base.origin}/signup?${params.toString()}`;
  } catch {
    return res.status(500).json({ status: false, message: 'Server configuration error' });
  }

  return res.json({ status: true, redirectUrl });
});

// ── Serve the HTML form ───────────────────────────────────────────────────────
// Optionally serve plain-html.html from the same directory.
// Replace this with your own template engine (EJS, Handlebars, etc.).
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'plain-html.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('EMAP partner signup server listening on port ' + PORT);
  console.log('EMAP_BASE_URL:', EMAP_BASE_URL);
  if (!process.env.EMAP_PARTNER_SECRET_KEY) {
    console.warn('EMAP_PARTNER_SECRET_KEY not set — signups will not be attributed to a partner');
  }
});

/**
 * Example: client-side form that calls this server
 *
 * Replace the submit handler in plain-html.html with this fetch-based version
 * when using this Express server:
 *
 *   document.getElementById('signup-form').addEventListener('submit', async function(e) {
 *     e.preventDefault();
 *
 *     const btn = document.getElementById('submit-btn');
 *     btn.disabled = true;
 *     btn.textContent = 'Redirecting…';
 *
 *     const formData = new FormData(this);
 *     const body = Object.fromEntries(formData.entries());
 *
 *     const resp = await fetch('/api/build-redirect', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(body),
 *     });
 *     const data = await resp.json();
 *
 *     if (!resp.ok) {
 *       // display errors from data.errors
 *       btn.disabled = false;
 *       btn.textContent = 'Continue to Easy Pay Direct →';
 *       return;
 *     }
 *
 *     window.location.href = data.redirectUrl;
 *   });
 */
