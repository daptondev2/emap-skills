/**
 * EMAP Partner Integration 3 — API Submission (Next.js App Router)
 *
 * File location: app/api/signup/route.ts
 *
 * Environment variables (set in .env.local — never commit this file):
 *   EMAP_BASE_URL    = https://app.easypaydirect.com
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

// ── Validation ────────────────────────────────────────────────────────────────

function validatePayload(body: Record<string, unknown>): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!body.first_name || typeof body.first_name !== 'string' || !body.first_name.trim()) {
    errors.first_name = ['First name is required'];
  }
  if (!body.last_name || typeof body.last_name !== 'string' || !body.last_name.trim()) {
    errors.last_name = ['Last name is required'];
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email) {
    errors.email = ['Email is required'];
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = ['A valid email address is required'];
  }

  if (!body.phone || typeof body.phone !== 'string' || !body.phone.trim()) {
    errors.phone = ['Phone is required'];
  }

  // Accept either 'name' (EMAP's field name) or 'company_name' (common form field name)
  const name = (body.name || body.company_name) as string | undefined;
  if (!name || !String(name).trim()) {
    errors.name = ['Company name is required'];
  }

  if (!body.website || typeof body.website !== 'string' || !body.website.trim()) {
    errors.website = ['Website is required'];
  }
  if (!body.country || typeof body.country !== 'string' || !body.country.trim()) {
    errors.country = ['Country is required'];
  }

  const sales = Number(body.annual_sales);
  if (!body.annual_sales || isNaN(sales) || sales < 1) {
    errors.annual_sales = ['Annual sales must be a positive number'];
  }

  const country = String(body.country || '').toUpperCase();
  if (country === 'US' && (!body.business_state || !String(body.business_state).trim())) {
    errors.business_state = ['State is required for US businesses'];
  }

  return errors;
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

  if (body.business_state) payload.business_state = String(body.business_state).trim().toUpperCase();
  if (body.promo_code)     payload.promo_code = String(body.promo_code).trim();

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
