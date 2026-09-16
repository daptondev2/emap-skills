# Integration 2 Templates

## Templates

### `plain-html.html`
A complete standalone HTML page. No backend required. The form collects step-1 data and on
submit redirects the browser to EMAP's `/signup` with all values as query parameters.

**Use when:** you have a static site, a CMS with no custom server code, or you want the
simplest possible integration.

**Setup:** Set `EMAP_BASE_URL` at the top of the `<script>` block. Optionally set
`EMAP_PARTNER_SECRET_KEY` if you have a partner key (or append it server-side for cleaner separation).

### `node-express.js`
An Express.js server that builds the redirect URL server-side and returns it to the browser.
The browser then follows the URL.

**Use when:** you have a Node.js backend and want to keep `EMAP_PARTNER_SECRET_KEY` out of
your frontend JavaScript bundle.

**Setup:**
```bash
npm install express dotenv
```
Create `.env`:
```
EMAP_BASE_URL=https://emap.epd.dev
EMAP_PARTNER_SECRET_KEY=your_key_here
PORT=3000
```
Run: `node node-express.js`

### `nextjs-route.ts`
A Next.js App Router route handler at `app/api/build-redirect/route.ts`. Validates the
form fields server-side, builds the EMAP redirect URL, and returns it as JSON. The browser
then follows the URL.

**Setup:** Add to `.env.local`:
```
EMAP_BASE_URL=https://emap.epd.dev
EMAP_PARTNER_SECRET_KEY=your_key_here
```

### `php-vanilla.php`
A single PHP file that renders the form (GET) and builds the redirect URL (POST), returning
`{ "status": true, "redirectUrl": "..." }` as JSON. Includes CSRF protection, honeypot,
country/state/industry dropdowns loaded from EMAP API, and client-side redirect on success.

**Requirements:** PHP 7.4+

**Setup:** Set in your server environment:
```
EMAP_BASE_URL=https://emap.epd.dev
EMAP_PARTNER_SECRET_KEY=your_key_here
```

---

## Customisation

1. **Styling:** Replace the inline CSS with your own classes. The templates use minimal styles only.
2. **Fields:** Add or remove optional fields. Required fields (`first_name`, `last_name`, `email`,
   `phone`, `company_name`, `website`, `country`, `annual_sales`) must stay.
3. **Auto-submit:** To trigger EMAP's auto-submit, include all the optional fields listed in
   [`../../references/field-catalog.md`](../../references/field-catalog.md) under "Auto-submit fields".

---

## Testing

1. Set `EMAP_BASE_URL` to the EMAP staging URL.
2. Fill in the form and submit.
3. Verify you are redirected to EMAP with the fields pre-filled.
4. For full auto-submit: include all non-excluded fields, verify EMAP auto-submits and you
   land on step 2.
