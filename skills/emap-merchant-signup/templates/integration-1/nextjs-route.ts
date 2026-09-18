/**
 * EMAP Partner Integration 1 — Full 6-Step Form (Next.js App Router)
 *
 * Environment variables (set in .env.local — never commit this file):
 *   EMAP_BASE_URL    = https://emap.epd.dev
 *   EMAP_PARTNER_KEY = your_partner_key_here
 *
 * File layout — create one file per route:
 *
 *   app/api/countries/route.ts          ← GET  /api/countries
 *   app/api/states/route.ts             ← GET  /api/states
 *   app/api/industry-types/route.ts     ← GET  /api/industry-types
 *   app/api/shopping-carts/route.ts     ← GET  /api/shopping-carts
 *   app/api/referral-sources/route.ts   ← GET  /api/referral-sources
 *   app/api/interest-details/route.ts   ← GET  /api/interest-details
 *   app/api/step/1/route.ts             ← POST /api/step/1  (ExternalSignupRequest)
 *   app/api/step/2/route.ts             ← POST /api/step/2  (ApplicationStepRequest step_count=2)
 *   app/api/step/3/route.ts             ← POST /api/step/3  (ApplicationStepRequest step_count=3)
 *   app/api/step/4/route.ts             ← POST /api/step/4  (HandleOwnershipRequest)
 *   app/api/step/5/route.ts             ← POST /api/step/5  (ApplicationStepRequest step_count=5)
 *   app/api/step/6/route.ts             ← POST /api/step/6  (ApplicationStepRequest step_count=6)
 *
 * Each section below is a complete, self-contained file. Copy the relevant
 * section into the file path shown in the header comment.
 */

import { NextRequest, NextResponse } from 'next/server';

// ── Shared config (copy into each route file) ──────────────────────────────────

const EMAP_BASE_URL    = process.env.EMAP_BASE_URL;
const EMAP_PARTNER_KEY = process.env.EMAP_PARTNER_KEY;

if (!EMAP_BASE_URL) throw new Error('EMAP_BASE_URL environment variable is required');

const emapOrigin = new URL(EMAP_BASE_URL).origin;

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

// ── Shared helper: proxy a POST to EMAP ───────────────────────────────────────

async function proxyPost(emapPath: string, body: unknown): Promise<NextResponse> {
  let emapRes: Response;
  let emapData: unknown;

  try {
    emapRes  = await fetch(`${emapOrigin}${emapPath}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify(body),
    });
    emapData = await emapRes.json();
  } catch (err) {
    console.error('EMAP network error:', (err as Error).message);
    return NextResponse.json(
      { status: false, message: 'EMAP is temporarily unavailable. Please try again.' },
      { status: 502, headers: NO_STORE }
    );
  }

  if (emapRes.status === 429) {
    return NextResponse.json(
      { status: false, message: 'Too many requests. Please wait a few minutes and try again.' },
      { status: 429, headers: NO_STORE }
    );
  }

  if (emapRes.status >= 500) {
    console.error('EMAP returned HTTP', emapRes.status, 'for', emapPath);
    return NextResponse.json(
      { status: false, message: 'EMAP is temporarily unavailable. Please try again.' },
      { status: 502, headers: NO_STORE }
    );
  }

  return NextResponse.json(emapData, { status: emapRes.status, headers: NO_STORE });
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/api/countries/route.ts
// ═════════════════════════════════════════════════════════════════════════════

export async function GET_countries(): Promise<NextResponse> {
  try {
    const res  = await fetch(`${emapOrigin}/api/partner/countries`, {
      headers: { 'Accept': 'application/json' },
      next:    { revalidate: 3600 },
    });
    const data = await res.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (_) {
    return NextResponse.json({ data: [] }, { status: 502 });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/api/states/route.ts
// ═════════════════════════════════════════════════════════════════════════════

export async function GET_states(): Promise<NextResponse> {
  try {
    const res  = await fetch(`${emapOrigin}/api/partner/states`, {
      headers: { 'Accept': 'application/json' },
      next:    { revalidate: 3600 },
    });
    const data = await res.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (_) {
    return NextResponse.json({ data: [] }, { status: 502 });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/api/industry-types/route.ts
// ═════════════════════════════════════════════════════════════════════════════

export async function GET_industryTypes(): Promise<NextResponse> {
  try {
    const res  = await fetch(`${emapOrigin}/api/partner/industry-types`, {
      headers: { 'Accept': 'application/json' },
      next:    { revalidate: 3600 },
    });
    const data = await res.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (_) {
    return NextResponse.json({ data: [] }, { status: 502 });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/api/shopping-carts/route.ts
// ═════════════════════════════════════════════════════════════════════════════

export async function GET_shoppingCarts(): Promise<NextResponse> {
  try {
    const res  = await fetch(`${emapOrigin}/api/partner/shopping-carts`, {
      headers: { 'Accept': 'application/json' },
      next:    { revalidate: 3600 },
    });
    const data = await res.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (_) {
    return NextResponse.json({ data: [] }, { status: 502 });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/api/referral-sources/route.ts
// ═════════════════════════════════════════════════════════════════════════════

export async function GET_referralSources(): Promise<NextResponse> {
  try {
    const res  = await fetch(`${emapOrigin}/api/partner/referral-sources`, {
      headers: { 'Accept': 'application/json' },
      next:    { revalidate: 3600 },
    });
    const data = await res.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (_) {
    return NextResponse.json({ data: [] }, { status: 502 });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/api/interest-details/route.ts
// ═════════════════════════════════════════════════════════════════════════════

export async function GET_interestDetails(): Promise<NextResponse> {
  try {
    const res  = await fetch(`${emapOrigin}/api/partner/interest-details`, {
      headers: { 'Accept': 'application/json' },
      next:    { revalidate: 3600 },
    });
    const data = await res.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (_) {
    return NextResponse.json({ data: [] }, { status: 502 });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/api/step/1/route.ts
// POST /api/step/1 → EMAP POST /api/v1/signup  (ExternalSignupRequest)
// ═════════════════════════════════════════════════════════════════════════════

export async function POST_step1(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ status: false, message: 'Invalid JSON body' }, { status: 400 }); }

  // Honeypot — real users never fill this hidden field; bots often do.
  // Reject silently (fake success, no EMAP call) so the bot has no signal to adapt to.
  if (body._hp) {
    return NextResponse.json({ status: true, message: 'Success' }, { headers: NO_STORE });
  }

  const { first_name, last_name, email, phone, name, company_name,
          website, country, annual_sales, business_state, industry_type,
          industry_type_other, promo_code } = body as Record<string, string>;

  const companyName = (name || company_name || '').trim();
  const missing: string[] = [];
  if (!String(first_name    || '').trim())  missing.push('first_name');
  if (!String(last_name     || '').trim())  missing.push('last_name');
  if (!String(email         || '').trim())  missing.push('email');
  if (!String(phone         || '').trim())  missing.push('phone');
  if (!companyName)                         missing.push('name');
  if (!String(website       || '').trim())  missing.push('website');
  if (!String(country       || '').trim())  missing.push('country');
  if (!annual_sales)                        missing.push('annual_sales');
  if (!String(industry_type || '').trim())  missing.push('industry_type');

  if (missing.length > 0) {
    const errors: Record<string, string[]> = {};
    missing.forEach(k => { errors[k] = [k.replace(/_/g, ' ') + ' is required']; });
    return NextResponse.json({ status: false, message: 'Validation failed', errors }, { status: 422, headers: NO_STORE });
  }

  const payload: Record<string, unknown> = {
    first_name:    String(first_name).trim(),
    last_name:     String(last_name).trim(),
    email:         String(email).trim().toLowerCase(),
    phone:         String(phone).trim(),
    name:          companyName,
    website:       String(website).trim(),
    country:       String(country).trim().toUpperCase(),
    annual_sales:  Number(annual_sales),
    industry_type: String(industry_type).trim(),
  };

  if (business_state)      payload.business_state      = String(business_state).trim().toUpperCase();
  if (industry_type_other) payload.industry_type_other = String(industry_type_other).trim();
  if (promo_code)          payload.promo_code          = String(promo_code).trim();
  if (EMAP_PARTNER_KEY)  payload.partner_key       = EMAP_PARTNER_KEY;

  return proxyPost('/api/v1/signup', payload);
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/api/step/2/route.ts
// POST /api/step/2 → EMAP POST /api/v1/application/step (step_count=2)
// ═════════════════════════════════════════════════════════════════════════════

export async function POST_step2(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ status: false, message: 'Invalid JSON body' }, { status: 400 }); }

  if (!body.uuid) {
    return NextResponse.json({ status: false, message: 'uuid is required' }, { status: 422, headers: NO_STORE });
  }

  // country_from_step1 is sent by the client for this check only; it is never
  // forwarded to EMAP (stripped below).
  const country = String(body.country_from_step1 ?? '').trim().toUpperCase();
  const errors: Record<string, string[]> = {};

  // federal_tax_id: required for every country except Canada. EMAP's signup
  // form also treats a Sole-Proprietorship as exempt, but live testing shows
  // the API does not honor that exemption — verified against both a US and a
  // Germany Sole-Proprietorship submission, both rejected with "required for
  // all companies except Canada and Sole-Proprietorships" when the field was
  // omitted. Canada is the only exemption that actually works.
  const einRequired = country !== 'CA';
  const ein = String(body.federal_tax_id ?? '').trim();
  if (einRequired) {
    if (!ein) {
      errors.federal_tax_id = ['Tax ID is required'];
    } else {
      // US/CA/PR: XXX-XX-XXXX (3-2-4); every other country: XX-XXXXXXX (2-7) —
      // matches Cleave.js formatConfig in manageFederalTaxIdFormat exactly.
      const isUsCaPr = country === 'US' || country === 'CA' || country === 'PR';
      const einPattern = isUsCaPr ? /^\d{3}-\d{2}-\d{4}$/ : /^\d{2}-\d{7}$/;
      if (!einPattern.test(ein)) {
        errors.federal_tax_id = [isUsCaPr
          ? 'Tax ID must be in the format XXX-XX-XXXX (e.g. 123-45-6789)'
          : 'Tax ID must be in the format XX-XXXXXXX (e.g. 12-3456789)'];
      }
    }
  }

  // business_register_number: required for every country except US. EMAP's
  // signup form also treats Puerto Rico and a CA Sole-Proprietorship as
  // exempt, but live testing shows the API requires it for both — verified
  // against a live Puerto Rico submission, rejected when the field was
  // omitted. US is the only exemption that actually works.
  const regRequired = country !== 'US';
  const regNumber = String(body.business_register_number ?? '').trim();
  if (regRequired && !regNumber) {
    errors.business_register_number = ['Business registration number is required'];
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ status: false, message: 'Validation failed', errors }, { status: 422, headers: NO_STORE });
  }

  const { country_from_step1, ...forwardBody } = body;
  return proxyPost('/api/v1/application/step', { ...forwardBody, step_count: 2 });
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/api/step/3/route.ts
// POST /api/step/3 → EMAP POST /api/v1/application/step (step_count=3)
// ═════════════════════════════════════════════════════════════════════════════

export async function POST_step3(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ status: false, message: 'Invalid JSON body' }, { status: 400 }); }

  if (!body.uuid) {
    return NextResponse.json({ status: false, message: 'uuid is required' }, { status: 422, headers: NO_STORE });
  }

  return proxyPost('/api/v1/application/step', { ...body, step_count: 3 });
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/api/step/4/route.ts
// POST /api/step/4 → EMAP POST /api/v1/ownership  (HandleOwnershipRequest)
// Fields use dot-notation: first_name.1, ssn.1, etc.
// ═════════════════════════════════════════════════════════════════════════════

export async function POST_step4(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ status: false, message: 'Invalid JSON body' }, { status: 400 }); }

  if (!body.uuid) {
    return NextResponse.json({ status: false, message: 'uuid is required' }, { status: 422, headers: NO_STORE });
  }

  // SSN/SIN — nested as { ssn: { '1': '...', '2': '...' } } from the client toNestedDot
  // helper. Format is keyed off country_from_step1 (the single Step 1 formation
  // country, sent by the client for this check only and never forwarded to EMAP),
  // applied identically to BOTH owners — NOT each owner's own country.1/country.2
  // (home address/residence, used only for driver's license gating). Matches
  // EMAP's own variantA/step4 js.blade.php exactly: selectedCountry = $company->country
  // drives both owner_ssn Cleave masks and validateSSN() there.
  const SSN_RE = /^\d{3}-\d{2}-\d{4}$/;
  const ssnObj = (body.ssn && typeof body.ssn === 'object' ? body.ssn : {}) as Record<string, unknown>;
  const ssnCountry = String(body.country_from_step1 ?? '').trim().toUpperCase();
  const ssnNeedsFormat = ssnCountry === 'US' || ssnCountry === 'CA' || ssnCountry === 'PR';
  const errors: Record<string, string[]> = {};

  for (const n of ['1', '2'] as const) {
    if (ssnObj[n] !== undefined) {
      const val = String(ssnObj[n]).trim();
      if (!val) {
        errors[`ssn.${n}`] = ['SSN/SIN is required'];
      } else if (ssnNeedsFormat && !SSN_RE.test(val)) {
        errors[`ssn.${n}`] = ['SSN/SIN must be in the format XXX-XX-XXXX (e.g. 123-45-6789)'];
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { status: false, message: 'Validation failed', errors },
      { status: 422, headers: NO_STORE }
    );
  }

  const { country_from_step1, ...ownershipBody } = body;
  return proxyPost('/api/v1/ownership', ownershipBody);
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/api/step/5/route.ts
// POST /api/step/5 → EMAP POST /api/v1/application/step (step_count=5)
// ═════════════════════════════════════════════════════════════════════════════

export async function POST_step5(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ status: false, message: 'Invalid JSON body' }, { status: 400 }); }

  if (!body.uuid) {
    return NextResponse.json({ status: false, message: 'uuid is required' }, { status: 422, headers: NO_STORE });
  }

  return proxyPost('/api/v1/application/step', { ...body, step_count: 5 });
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/api/step/6/route.ts
// POST /api/step/6 → EMAP POST /api/v1/application/step (step_count=6)
// ═════════════════════════════════════════════════════════════════════════════

export async function POST_step6(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ status: false, message: 'Invalid JSON body' }, { status: 400 }); }

  if (!body.uuid) {
    return NextResponse.json({ status: false, message: 'uuid is required' }, { status: 422, headers: NO_STORE });
  }

  return proxyPost('/api/v1/application/step', { ...body, step_count: 6 });
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO USE THIS FILE
 *
 * Each export above (GET_countries, POST_step1, etc.) belongs in its own
 * Next.js App Router route file. The export must be named GET or POST:
 *
 *   // app/api/countries/route.ts
 *   export { GET_countries as GET } from '@/path/to/this/file';
 *
 *   // app/api/step/1/route.ts
 *   export { POST_step1 as POST } from '@/path/to/this/file';
 *
 * Or copy each function directly into its own route file and rename it GET/POST.
 * ─────────────────────────────────────────────────────────────────────────────
 */
