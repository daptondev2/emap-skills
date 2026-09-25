# Integration 2 Templates

Works in any tech stack. No server-side code is involved: the redirect URL is built and
followed entirely in the merchant's browser.
Keep it that way. EMAP rate-limits signups by the caller's IP, so the requests must come from
the merchant's browser, not from a server proxy.

## Templates

### `plain-html.html`
A complete standalone HTML page. The form collects step-1 data and on submit redirects
the browser to EMAP's `/signup` with all values as query parameters, built entirely
client-side. Once name, email and phone are filled in, it also auto-saves them to
`/api/v1/signup/auto-save` in the background (see `references/mode-2-redirect.md`).

**Use when:** you have a static site, a CMS with no custom server code, or you want the
simplest possible integration.

**Setup:** Set `EMAP_BASE_URL` at the top of the `<script>` block. The template ships with
`https://emap.epd.dev`, EMAP's **test server**; switch to the production URL at launch. Optionally
set `EMAP_PARTNER_KEY` if you have a partner key. See the Partner key visibility section below for
the client-visibility tradeoff.

### `SignupForm.tsx`
A **React component** wrapping the exact same tested markup, styles, and logic as
`plain-html.html`. It makes no server-side calls: the Step 1 auto-save `POST` and the redirect
are made entirely in the browser, same as the plain HTML version.

**Use when:** the site is built with React. That covers Next.js (App or Pages Router), Vite,
Remix / React Router, Gatsby, and Astro (`client:only="react"`). For a JavaScript project,
rename it to `.jsx` and delete the type annotations. It is safe under StrictMode and repeated
mount/unmount, and its CSS is scoped under `.emap-signup`.

**Setup:** Import and render `<SignupForm />` anywhere in your app. Set the same
`EMAP_BASE_URL` / `EMAP_PARTNER_KEY` constants inside the component's embedded script.

### Any other stack
Vue / Nuxt, Angular, Svelte, PHP / WordPress, Rails, Django, ASP.NET, static site generators,
site builders, and mobile WebViews all work. `plain-html.html` is built to be embedded: its CSS
is scoped under `.emap-signup`, and its script is IIFE-wrapped and starts via `onReady()`, so it
runs correctly even when injected after page load. See
[`../../references/stack-guide.md`](../../references/stack-guide.md) for how to deliver it in each
stack, and for the porting rules if you rewrite it natively.

---

## Customisation

1. **Styling:** Replace the inline CSS with your own classes. The templates use minimal styles only.
2. **Fields:** Add or remove optional fields. Required fields (`first_name`, `last_name`, `email`,
   `phone`, `company_name`, `website`, `country`, `annual_sales`) must stay.
3. **Auto-submit:** EMAP submits the prefilled form for the merchant when `first_name`,
   `last_name`, `company_name`, `phone` and `email` are all present and its own checks on the
   prefilled data pass. Otherwise the merchant reviews the form and submits it. Keep those five
   fields. See [`../../references/mode-2-redirect.md`](../../references/mode-2-redirect.md#how-it-works).

---

## Partner key visibility

`EMAP_PARTNER_KEY` is a plain constant in client-side JS, so anyone who views the page source can
see it. It also appears in the redirect URL. EMAP names that URL param `secretKey`, but the value
is the partner key: an attribution value, not a credential. The realistic risk of it being seen is
another site's signups being mis-attributed. See `references/security-checklist.md` for the full
tradeoff. Never log the redirect URL: it also contains the merchant's name, email and phone.

---

## Testing

Test against EMAP's **test server** (`https://emap.epd.dev`) only, with an email address you
control.

1. Keep `EMAP_BASE_URL` set to the test server.
2. Fill in every field with valid data and submit.
3. Verify EMAP submits the prefilled form for you and you land on step 2.
4. Submit again with an unrecognisable website. Verify EMAP shows its form prefilled and waits
   for you to fix it and submit.
5. Leave the promo code empty and verify `promo_code` isn't in the redirect URL.
