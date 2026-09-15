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

// ── Regex constants ───────────────────────────────────────────────────────────
// Same patterns EMAP uses server-side so client validation is always compatible.
const PHONE_RE   = /^[0-9+\-()\s]+$/;
const WEBSITE_RE = /^(https?:\/\/)?[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/;
const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const VALID_US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]);

// ── Validation ───────────────────────────────────────────────────────────────
function validateSignupFields(body) {
  const errors = {};

  const firstName = body.first_name?.trim() ?? '';
  if (!firstName)              errors.first_name = 'First name is required';
  else if (firstName.length > 60) errors.first_name = 'First name must be 60 characters or fewer';

  const lastName = body.last_name?.trim() ?? '';
  if (!lastName)               errors.last_name  = 'Last name is required';
  else if (lastName.length > 60) errors.last_name = 'Last name must be 60 characters or fewer';

  const email = body.email?.trim() ?? '';
  if (!email)                           errors.email = 'Email is required';
  else if (!EMAIL_RE.test(email))       errors.email = 'A valid email address is required';

  const phone = body.phone?.trim() ?? '';
  if (!phone)                           errors.phone = 'Phone is required';
  else if (phone.length > 20)           errors.phone = 'Phone must be 20 characters or fewer';
  else if (!PHONE_RE.test(phone))       errors.phone = 'Phone may only contain digits, +, -, (, ), and spaces';

  const companyName = body.company_name?.trim() ?? '';
  if (!companyName)                     errors.company_name = 'Company name is required';
  else if (companyName.length > 60)     errors.company_name = 'Company name must be 60 characters or fewer';

  const website = body.website?.trim() ?? '';
  if (!website)                         errors.website = 'Website is required';
  else if (!WEBSITE_RE.test(website))   errors.website = 'Website must be a valid URL (e.g. https://yourcompany.com)';

  const country = body.country?.trim().toUpperCase() ?? '';
  if (!country)                         errors.country = 'Country is required';
  else if (country.length !== 2)        errors.country = 'Country must be a 2-character ISO code (e.g. US, CA)';

  const sales = Number(body.annual_sales);
  if (!body.annual_sales || isNaN(sales) || sales < 1)
                                        errors.annual_sales = 'Annual sales must be at least 1';
  else if (sales > 999999999999)        errors.annual_sales = 'Annual sales value is too large';

  if (country === 'US') {
    const state = body.business_state?.trim().toUpperCase() ?? '';
    if (!state)                         errors.business_state = 'State is required for US businesses';
    else if (!VALID_US_STATES.has(state)) errors.business_state = 'Must be a valid 2-character US state code (e.g. CA, TX)';
  }

  // Optional auto-submit fields — validate format when provided
  if (body.highest_transaction_amount !== undefined && body.highest_transaction_amount !== '') {
    const hta = Number(body.highest_transaction_amount);
    if (isNaN(hta) || hta < 0)         errors.highest_transaction_amount = 'Highest transaction amount must be a positive number';
    else if (String(body.highest_transaction_amount).length > 16)
                                        errors.highest_transaction_amount = 'Highest transaction amount must be 16 characters or fewer';
  }

  if (body.current_processing !== undefined && body.current_processing !== '') {
    const cp = String(body.current_processing);
    if (cp !== '0' && cp !== '1')       errors.current_processing = 'Currently processing must be 0 or 1';
  }

  if (body.expected_monthly_volume !== undefined && body.expected_monthly_volume !== '') {
    const emv = Number(body.expected_monthly_volume);
    if (isNaN(emv) || emv < 0)         errors.expected_monthly_volume = 'Expected monthly volume must be a positive number';
  }

  // Card entry percentages: each must be 0–100 and they must sum to 100 when all three are present
  const hasCardFields = body.card_swiped !== undefined || body.customer_entered !== undefined || body.staff_entered !== undefined;
  if (hasCardFields) {
    const swiped   = Number(body.card_swiped   ?? 0);
    const custEntr = Number(body.customer_entered ?? 0);
    const staffEntr = Number(body.staff_entered  ?? 0);

    if (isNaN(swiped)   || swiped   < 0 || swiped   > 100) errors.card_swiped       = 'Card swiped % must be 0–100';
    if (isNaN(custEntr) || custEntr < 0 || custEntr > 100) errors.customer_entered  = 'Customer entered % must be 0–100';
    if (isNaN(staffEntr)|| staffEntr< 0 || staffEntr> 100) errors.staff_entered     = 'Staff entered % must be 0–100';

    if (!errors.card_swiped && !errors.customer_entered && !errors.staff_entered) {
      if (swiped + custEntr + staffEntr !== 100) {
        errors.card_swiped = 'Card swiped, customer entered, and staff entered percentages must sum to 100';
      }
    }
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
