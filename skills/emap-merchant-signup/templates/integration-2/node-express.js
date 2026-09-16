/**
 * EMAP Partner Integration 2 — Redirect Handoff (Express.js)
 *
 * Install:  npm install express dotenv
 *
 * .env file:
 *   EMAP_BASE_URL=https://emap.epd.dev
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

// Allowed URL params — same field set as Integration 1 Step 1 (basic merchant info only).
// Do NOT add step-3/5 fields (card_swiped, marketing_model, current_processing, etc.) here —
// Integration 2 only collects step-1 data; EMAP handles all remaining steps.
const ALLOWED_FORM_FIELDS = [
  'first_name', 'last_name', 'email', 'phone', 'company_name', 'website',
  'country', 'annual_sales', 'business_state', 'industry_type',
  'industry_type_other', 'promo_code',
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

  const country = body.country?.trim() ?? '';
  if (!country)                         errors.country = 'Country is required';

  const sales = Number(body.annual_sales);
  if (!body.annual_sales || isNaN(sales) || sales < 1)
                                        errors.annual_sales = 'Annual sales must be at least 1';
  else if (sales > 999999999999)        errors.annual_sales = 'Annual sales value is too large';

  if (body.business_state) {
    const state = body.business_state.trim().toUpperCase();
    if (!VALID_US_STATES.has(state))    errors.business_state = 'Must be a valid 2-character US state code (e.g. CA, TX)';
  }

  return errors;
}

// ── POST /api/build-redirect ─────────────────────────────────────────────────
// Validates fields, builds the EMAP redirect URL, and returns it to the client.
app.post('/api/build-redirect', function (req, res) {
  // Honeypot — real users never fill this hidden field; bots often do.
  // Reject silently (fake redirect, never built against EMAP) so the bot has no signal to adapt to.
  if (req.body._hp) {
    let base;
    try { base = new URL(EMAP_BASE_URL); } catch { return res.status(500).json({ status: false, message: 'Server configuration error' }); }
    return res.json({ status: true, redirectUrl: `${base.origin}/signup` });
  }

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
