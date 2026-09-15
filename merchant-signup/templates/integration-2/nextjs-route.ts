/**
 * EMAP Partner Integration 2 — Redirect Handoff (Next.js App Router)
 *
 * File location: app/api/build-redirect/route.ts
 *
 * Environment variables (set in .env.local — never commit this file):
 *   EMAP_BASE_URL           = https://emap.epd.dev
 *   EMAP_PARTNER_SECRET_KEY = your_key_here   # optional; enables partner attribution
 *
 * Flow:
 *   1. Browser submits the form to POST /api/build-redirect
 *   2. This route validates the fields, builds the EMAP redirect URL, returns { redirectUrl }
 *   3. Browser follows the URL → EMAP prefills the form → auto-submits when all fields present
 */

import { NextRequest, NextResponse } from 'next/server';

// ── Config ─────────────────────────────────────────────────────────────────────

const EMAP_BASE_URL = process.env.EMAP_BASE_URL;
const EMAP_PARTNER_SECRET_KEY = process.env.EMAP_PARTNER_SECRET_KEY;

if (!EMAP_BASE_URL) {
  throw new Error('EMAP_BASE_URL environment variable is required');
}

let emapOrigin: string;
try {
  emapOrigin = new URL(EMAP_BASE_URL).origin;
} catch {
  throw new Error('EMAP_BASE_URL is not a valid URL');
}

// ── Whitelists ─────────────────────────────────────────────────────────────────

// Same field set as Integration 1 Step 1 — basic merchant info only.
// Do NOT add step-3/5 fields here; Integration 2 only collects step-1 data.
const ALLOWED_FORM_FIELDS = [
  'first_name', 'last_name', 'email', 'phone', 'company_name', 'website',
  'country', 'annual_sales', 'business_state', 'industry_type',
  'industry_type_other', 'promo_code',
] as const;

const TRACKING_FIELDS = [
  'utm_campaign', 'utm_source', 'utm_medium', 'utm_term', 'utm_content',
  'gclid', 'gbraid', 'wbraid',
] as const;

// ── Regex constants ────────────────────────────────────────────────────────────

const PHONE_RE   = /^[0-9+\-()\s]+$/;
const WEBSITE_RE = /^(https?:\/\/)?[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/;
const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const VALID_US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]);

// ── Validation ────────────────────────────────────────────────────────────────

interface ValidationErrors { [field: string]: string }

function validateFields(body: Record<string, unknown>): ValidationErrors {
  const errors: ValidationErrors = {};

  const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : '';
  if (!firstName)                  errors.first_name = 'First name is required';
  else if (firstName.length > 60)  errors.first_name = 'First name must be 60 characters or fewer';

  const lastName = typeof body.last_name === 'string' ? body.last_name.trim() : '';
  if (!lastName)                   errors.last_name  = 'Last name is required';
  else if (lastName.length > 60)   errors.last_name  = 'Last name must be 60 characters or fewer';

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email)                      errors.email = 'Email is required';
  else if (!EMAIL_RE.test(email))  errors.email = 'A valid email address is required';

  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!phone)                      errors.phone = 'Phone is required';
  else if (phone.length > 20)      errors.phone = 'Phone must be 20 characters or fewer';
  else if (!PHONE_RE.test(phone))  errors.phone = 'Phone may only contain digits, +, -, (, ), and spaces';

  const company = typeof body.company_name === 'string' ? body.company_name.trim() : '';
  if (!company)                    errors.company_name = 'Company name is required';
  else if (company.length > 60)    errors.company_name = 'Company name must be 60 characters or fewer';

  const website = typeof body.website === 'string' ? body.website.trim() : '';
  if (!website)                       errors.website = 'Website is required';
  else if (!WEBSITE_RE.test(website)) errors.website = 'Website must be a valid URL (e.g. https://yourcompany.com)';

  // country is a full name (e.g. "United States") — not a 2-char code
  const country = typeof body.country === 'string' ? body.country.trim() : '';
  if (!country)                    errors.country = 'Country is required';

  const sales = Number(body.annual_sales);
  if (!body.annual_sales || isNaN(sales) || sales < 1)
                                   errors.annual_sales = 'Annual sales must be at least 1';
  else if (sales > 999_999_999_999) errors.annual_sales = 'Annual sales value is too large';

  // Validate business_state format if provided (client already enforces US-only display)
  if (body.business_state) {
    const state = typeof body.business_state === 'string' ? body.business_state.trim().toUpperCase() : '';
    if (!VALID_US_STATES.has(state)) errors.business_state = 'Must be a valid 2-character US state code (e.g. CA, TX)';
  }

  return errors;
}

// ── POST /api/build-redirect ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const errors = validateFields(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ status: false, errors }, { status: 422 });
  }

  const params = new URLSearchParams();

  // Add whitelisted form fields
  for (const field of ALLOWED_FORM_FIELDS) {
    const value = body[field];
    if (value != null && String(value).trim() !== '') {
      params.set(field, String(value).trim());
    }
  }

  // Pass through UTM/click tracking from the request body
  for (const field of TRACKING_FIELDS) {
    const value = body[field];
    if (value) params.set(field, String(value));
  }

  // Partner attribution — always from env, never from the incoming request
  if (EMAP_PARTNER_SECRET_KEY) {
    params.set('secretKey', EMAP_PARTNER_SECRET_KEY);
  }

  const redirectUrl = `${emapOrigin}/signup?${params.toString()}`;

  return NextResponse.json(
    { status: true, redirectUrl },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    }
  );
}
