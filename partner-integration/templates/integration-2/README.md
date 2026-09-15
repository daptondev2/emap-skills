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
EMAP_BASE_URL=https://app.easypaydirect.com
EMAP_PARTNER_SECRET_KEY=your_key_here
PORT=3000
```
Run: `node node-express.js`

---

## Customisation

1. **Styling:** Replace the inline CSS with your own classes. The templates use minimal styles only.
2. **Fields:** Add or remove optional fields. Required fields (`first_name`, `last_name`, `email`,
   `phone`, `company_name`, `website`, `country`, `annual_sales`) must stay.
3. **Auto-submit:** To trigger EMAP's auto-submit, include all the optional fields listed in
   [`../../references/field-catalog.md`](../../references/field-catalog.md) under "Auto-submit fields".
4. **Country list:** Expand the country dropdown to include all countries EMAP supports.
   EMAP resolves country names to IDs server-side.
5. **State list:** Expand the US states dropdown to include all 50 states + DC.

---

## Testing

1. Set `EMAP_BASE_URL` to the EMAP staging URL.
2. Fill in the form and submit.
3. Verify you are redirected to EMAP with the fields pre-filled.
4. For full auto-submit: include all non-excluded fields, verify EMAP auto-submits and you
   land on step 2.
