/**
 * EMAP Partner Integration 3 — Email-Based Signup (Next.js App Router)
 *
 * The partner fills in the merchant's step-1 details and submits.
 * This route proxies the data to EMAP /api/v1/signup, which creates the account
 * and emails the merchant a secure link to complete their full application on
 * Easy Pay Direct's platform.
 *
 * File location: app/api/signup/route.ts
 *
 * Environment variables (set in .env.local — never commit this file):
 *   EMAP_BASE_URL    = https://emap.epd.dev
 *   EMAP_PARTNER_KEY = your_partner_key_here
 *
 * Usage: POST /api/signup with JSON body matching SignupPayload below.
 */

import { NextRequest, NextResponse } from 'next/server';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SignupPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  name: string;           // company name — EMAP API uses 'name', not 'company_name'
  website: string;
  country: string;        // 2-char ISO code, e.g. 'US', 'CA'
  annual_sales: number;
  business_state?: string;
  industry_type?: string;
  industry_type_other?: string;
  promo_code?: string;
  partner_key?: string;   // injected server-side from env; never from the client
}

interface ValidationErrors {
  [field: string]: string[];
}

// ── Config ─────────────────────────────────────────────────────────────────────

const EMAP_BASE_URL = process.env.EMAP_BASE_URL;
const EMAP_PARTNER_KEY = process.env.EMAP_PARTNER_KEY;

if (!EMAP_BASE_URL) {
  throw new Error('EMAP_BASE_URL environment variable is required');
}

let emapOrigin: string;
try {
  emapOrigin = new URL(EMAP_BASE_URL).origin;
} catch {
  throw new Error('EMAP_BASE_URL is not a valid URL');
}

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

function validatePayload(body: Record<string, unknown>): ValidationErrors {
  const errors: ValidationErrors = {};

  const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : '';
  if (!firstName)                errors.first_name = ['First name is required'];
  else if (firstName.length > 60) errors.first_name = ['First name must be 60 characters or fewer'];

  const lastName = typeof body.last_name === 'string' ? body.last_name.trim() : '';
  if (!lastName)                 errors.last_name  = ['Last name is required'];
  else if (lastName.length > 60) errors.last_name  = ['Last name must be 60 characters or fewer'];

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email)                          errors.email = ['Email is required'];
  else if (!EMAIL_RE.test(email))      errors.email = ['A valid email address is required'];

  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!phone)                          errors.phone = ['Phone is required'];
  else if (phone.length > 20)          errors.phone = ['Phone must be 20 characters or fewer'];
  else if (!PHONE_RE.test(phone))      errors.phone = ['Phone may only contain digits, +, -, (, ), and spaces'];

  // Accept either 'name' (EMAP's field) or 'company_name' (common form field)
  const name = String((body.name || body.company_name) ?? '').trim();
  if (!name)                           errors.name = ['Company name is required'];
  else if (name.length > 60)           errors.name = ['Company name must be 60 characters or fewer'];

  const website = typeof body.website === 'string' ? body.website.trim() : '';
  if (!website)                        errors.website = ['Website is required'];
  else if (!WEBSITE_RE.test(website))  errors.website = ['Website must be a valid URL (e.g. https://yourcompany.com)'];

  const country = typeof body.country === 'string' ? body.country.trim().toUpperCase() : '';
  if (!country)                        errors.country = ['Country is required'];
  else if (country.length !== 2)       errors.country = ['Country must be a 2-character ISO code (e.g. US, CA)'];

  const sales = Number(body.annual_sales);
  if (!body.annual_sales || isNaN(sales) || sales < 1)
                                       errors.annual_sales = ['Annual sales must be at least 1'];
  else if (sales > 999_999_999_999)    errors.annual_sales = ['Annual sales value is too large'];

  if (country === 'US') {
    const state = typeof body.business_state === 'string'
      ? body.business_state.trim().toUpperCase() : '';
    if (!state)                          errors.business_state = ['State is required for US businesses'];
    else if (!VALID_US_STATES.has(state)) errors.business_state = ['Must be a valid 2-character US state code (e.g. CA, TX)'];
  }

  return errors;
}

// ── GET /api/industry-types ───────────────────────────────────────────────────
// Place this export in: app/api/industry-types/route.ts (rename export to GET)

export async function GET_industryTypes(): Promise<NextResponse> {
  try {
    const response = await fetch(`${emapOrigin}/api/partner/industry-types`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 },
    });
    const data = await response.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch {
    return NextResponse.json({ data: [] }, { status: 502 });
  }
}

// ── POST /api/signup ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: false, message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Server-side validation
  const validationErrors = validatePayload(body);
  if (Object.keys(validationErrors).length > 0) {
    return NextResponse.json(
      { status: false, message: 'Validation failed', errors: validationErrors },
      { status: 422 }
    );
  }

  // Build EMAP payload — only known fields; never forward raw body wholesale
  const payload: SignupPayload = {
    first_name:   String(body.first_name).trim(),
    last_name:    String(body.last_name).trim(),
    email:        String(body.email).trim().toLowerCase(),
    phone:        String(body.phone).trim(),
    name:         String(body.name || body.company_name || '').trim(),
    website:      String(body.website).trim(),
    country:      String(body.country).trim().toUpperCase(),
    annual_sales: Number(body.annual_sales),
  };

  if (body.business_state)      payload.business_state      = String(body.business_state).trim().toUpperCase();
  if (body.industry_type)       payload.industry_type       = String(body.industry_type).trim();
  if (body.industry_type_other) payload.industry_type_other = String(body.industry_type_other).trim();
  if (body.promo_code)          payload.promo_code          = String(body.promo_code).trim();

  // Partner key comes from env — never from the incoming request
  if (EMAP_PARTNER_KEY) {
    payload.partner_key = EMAP_PARTNER_KEY;
  }

  let emapResponse: Response;
  let emapData: unknown;

  try {
    emapResponse = await fetch(`${emapOrigin}/api/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // Never log the body — it contains PII + the partner key
      body: JSON.stringify(payload),
    });

    emapData = await emapResponse.json();
  } catch (networkError) {
    console.error('EMAP API network error:', (networkError as Error).message);
    return NextResponse.json(
      { status: false, message: 'EMAP is temporarily unavailable. Please try again.' },
      { status: 502 }
    );
  }

  if (emapResponse.status === 429) {
    return NextResponse.json(
      { status: false, message: 'Too many requests. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  if (emapResponse.status >= 500) {
    console.error('EMAP API returned HTTP', emapResponse.status);
    return NextResponse.json(
      { status: false, message: 'EMAP is temporarily unavailable. Please try again.' },
      { status: 502 }
    );
  }

  // Pass through 200 (success, existing user, company exists) and 422 (validation) as-is
  return NextResponse.json(emapData, { status: emapResponse.status });
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Resume Link Route: app/api/signup/resume-link/route.ts
 *
 * Create this file at: app/api/signup/resume-link/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * import { NextRequest, NextResponse } from 'next/server';
 *
 * const EMAP_BASE_URL = process.env.EMAP_BASE_URL!;
 * const emapOrigin = new URL(EMAP_BASE_URL).origin;
 *
 * export async function POST(request: NextRequest): Promise<NextResponse> {
 *   let body: { email?: string };
 *   try { body = await request.json(); } catch { body = {}; }
 *
 *   const email = body.email?.trim();
 *   if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
 *     return NextResponse.json(
 *       { status: false, message: 'A valid email address is required' },
 *       { status: 422 }
 *     );
 *   }
 *
 *   try {
 *     const emapResponse = await fetch(`${emapOrigin}/api/v1/signup/resume-link`, {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
 *       body: JSON.stringify({ email }),
 *     });
 *     const data = await emapResponse.json();
 *
 *     if (emapResponse.status === 429) {
 *       return NextResponse.json(
 *         { status: false, message: 'Too many attempts. Please try again in a few minutes.' },
 *         { status: 429 }
 *       );
 *     }
 *     return NextResponse.json(data, { status: emapResponse.status });
 *   } catch (err) {
 *     console.error('EMAP resume-link error:', (err as Error).message);
 *     return NextResponse.json(
 *       { status: false, message: 'Could not send the resume link. Please try again.' },
 *       { status: 502 }
 *     );
 *   }
 * }
 */
