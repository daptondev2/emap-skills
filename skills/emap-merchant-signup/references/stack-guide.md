# Stack guide: delivering the form in any tech stack

The form works in any web stack. There is exactly one architectural rule, and it is about
**where the EMAP requests come from**, not about which framework renders the page.

## The one rule: EMAP is called from the merchant's device

Every EMAP request (`POST /api/v1/signup`, `/api/v1/signup/auto-save`, `/api/v1/application/step`, `/api/v1/ownership`,
the `/api/partner/*` dropdown GETs) and the Integration 2 redirect must be sent **by the
merchant's browser** (or app), never by the partner's server.

**Why:** EMAP rate-limits and abuse-scores signups by the caller's IP address. When the browser
calls EMAP, each merchant is limited individually. If a partner's server proxies the calls, every
merchant arrives from that one server IP. One bad actor then gets *all* of that partner's signups
rate-limited, and EMAP loses the per-merchant signal it uses to stop spam.

The partner's site can have any backend it likes for everything else (rendering the page, auth,
CMS, analytics). This rule covers only the EMAP calls. Server-rendered pages are fine as long as
the EMAP request is made by JavaScript running in the page.

**Violations, by stack:** any of these calling EMAP is a build bug, not a design choice:

| Stack | Server-side code that must NOT call EMAP |
|---|---|
| Next.js | Route handlers (`app/**/route.ts`), `pages/api/*`, Server Actions (`'use server'`), `getServerSideProps`, Server Components |
| Remix / React Router | `loader` / `action` functions |
| Nuxt | `server/api/*`, `server/routes/*`, and `useFetch` / `useAsyncData` during SSR (they run on the server; use `$fetch` inside `onMounted`, or `{ server: false }`) |
| SvelteKit | `+page.server.*`, `+server.*`, form actions, and universal `load` in `+page.ts` (it runs on the server during SSR) |
| Angular | Anything that runs during Angular SSR (`ngOnInit` with `@angular/ssr`). Call EMAP after `afterNextRender`, or guard with `isPlatformBrowser` |
| Astro | Frontmatter (`---` block), endpoints, actions |
| PHP / WordPress / Laravel | `curl`, `file_get_contents`, `wp_remote_post`, Guzzle, `Http::post` |
| Rails / Django / Flask / ASP.NET / Node / Go / etc. | Any controller, view, handler, job, or serverless function making the HTTP request |

## Step 1: detect the stack

Detect the stack from the project. Ask the developer only if the signals are missing or
conflicting, for example in an empty directory or a monorepo with several frontends.

| Signal in the project | Stack |
|---|---|
| `package.json` has `next`, `react` (with Vite, Remix, React Router, Gatsby, CRA) | React |
| `package.json` has `vue` / `nuxt` | Vue / Nuxt |
| `package.json` has `@angular/core` | Angular |
| `package.json` has `svelte` / `@sveltejs/kit` | Svelte / SvelteKit |
| `package.json` has `solid-js`, `preact`, `lit`, `@builder.io/qwik` | Other component framework |
| `astro.config.*` | Astro (with `@astrojs/react`, you can use the React component) |
| `composer.json`, `*.php`, `wp-content/`, `*.blade.php` | PHP / WordPress / Laravel |
| `Gemfile` + `config/routes.rb` | Rails |
| `manage.py`, or `requirements.txt` / `pyproject.toml` with `django` / `flask` | Django / Flask |
| `*.csproj` with `.cshtml` / `.razor` | ASP.NET |
| `hugo.toml`, Jekyll `_config.yml`, `.eleventy.js` | Static site generator |
| Only `.html` files | Static site |
| The developer mentions Webflow, Wix, Squarespace, Shopify, Framer | Hosted site builder |
| React Native, Flutter, Swift, or Kotlin project | Mobile app |

## Step 2: deliver the form

Both templates in `templates/integration-<n>/` are the same, tested form:

- **`plain-html.html`** is the canonical reference. It is self-contained with no build step. Its
  CSS is scoped under `.emap-signup` and its script is wrapped in an IIFE that starts via
  `onReady()`. That means it can be embedded into any existing page without leaking styles or
  globals, even when the script is injected after page load.
- **`SignupForm.tsx`** is the same markup, CSS and script mounted by a React component.

### React (Next.js, Vite, Remix / React Router, Gatsby, CRA, Astro + React)

Use `SignupForm.tsx` and render it from any page or route.
- **Next.js:** it carries `'use client'`, so importing it from an App Router page or a Pages Router
  page both work.
- **Astro:** render it as `<MerchantSignupForm client:only="react" />`.
- **JavaScript projects:** rename it to `.jsx` and delete the type annotations.
- **Strict CSP:** the component injects its logic as an inline script. A site with a strict CSP
  (no `'unsafe-inline'` for scripts) needs a CSP hash for that script, or a native port.

### Other component frameworks (Vue / Nuxt, Angular, Svelte / SvelteKit, Solid, Preact, Lit, Qwik)

There are two options.

1. **Mount the reference (recommended, guaranteed identical).** Do what `SignupForm.tsx` does, in
   the framework's client-only mount hook:
   - Vue `onMounted`, Svelte `onMount`, Angular `afterNextRender`, Solid `onMount`.
   - Steps:
     1. Render a container element with `class="emap-signup"`.
     2. On mount, set its `innerHTML` to the markup inside `plain-html.html`'s
        `<div class="emap-signup">` element.
     3. Integration 1 only: load Cleave.js.
     4. Append a `<script>` element whose `text` is the contents of the inline script.
     5. On unmount, remove that script and empty the container.
   - Put the CSS in a **global** stylesheet. Framework-scoped styles don't reach `innerHTML` content:
     - Vue: a `<style>` block without `scoped`.
     - Angular: `ViewEncapsulation.None` or `styles.css`.
     - Svelte: a `:global(...)` block or a global stylesheet.

     The CSS is already prefixed with `.emap-signup`, so global is safe.
2. **Native 1:1 port.** Rewrite the form in the framework's own idioms, following the porting
   rules below. Use this when the team wants native component code. It takes more work and
   `verify_form.py` must pass.

### Server-rendered sites (PHP, WordPress, Laravel Blade, Rails ERB, Django/Jinja, ASP.NET Razor, Twig, Liquid, Handlebars, etc.)

Embed the reference into a page template:
1. **Save the CSS and the script as static asset files.** Copy `plain-html.html`'s first `<style>`
   block to a static `.css` file. Copy the inline `<script>` block's contents to a static `.js`
   file. Serve both as plain assets, not through the template engine, and reference them with
   `<link rel="stylesheet">` and `<script src defer>`.

   This avoids template syntax colliding with the JS:
   - Blade `@` and `{{ }}`
   - Razor `@`
   - Jinja, Django and Liquid `{{ }}` / `{% %}`
   - Handlebars `{{ }}`

   It also works under a strict CSP (`script-src 'self'`). If you must inline the code instead,
   wrap it in the engine's raw block: `@verbatim`, `{% raw %}`, `{% verbatim %}`, or `@@` escapes
   in Razor.
2. **Paste the markup** (the `<div class="emap-signup">…</div>` element) into the page template.
3. **Integration 1 only:** add the Cleave.js `<script src>` tag before your `.js` file.
4. **Do not copy the "Standalone-page chrome" style block.** It styles `body`.

**WordPress:** use a page template (theme or small plugin) with `wp_enqueue_style` /
`wp_enqueue_script`, or a Custom HTML block. Custom HTML blocks require the admin role to keep
`<script>` tags.

### Static sites and static site generators (plain HTML, Hugo, Jekyll, Eleventy, Astro without React)

- **Own page:** use `plain-html.html` as-is.
- **Inside an existing layout:** embed it using the server-rendered steps above, with the assets
  in the SSG's static folder.

### Hosted site builders (Webflow, Wix, Squarespace, Shopify, Framer)

- **If the builder's custom-code or embed block runs scripts:** paste the style block, the markup
  and the script there.
- **Otherwise:** host `plain-html.html` on any static host and `<iframe>` it or link to it.

The requests still come from the merchant's browser, so rate limiting sees the merchant's IP. The
templates navigate the top-level window for the EMAP handoff, so iframes work. If you sandbox the
iframe, allow `allow-scripts allow-forms allow-same-origin allow-top-navigation`.

### Mobile apps (React Native, Flutter, iOS, Android)

Host `plain-html.html` and load it in a WebView. A fully native form is acceptable only if the
device itself calls EMAP, never the app's backend, and it still has to follow the porting rules
below. It is a much larger job than the WebView.

## Porting rules (for any native port)

- **Behavior comes from `plain-html.html` and fields come from `signup-steps-schema.json`.** Port 1:1:
  - same fields and widget types
  - same validation, including per-country `countryVariants`
  - same conditional logic
  - same dropdown fetches with the embedded fallback data
  - same `localStorage` keys
  - same 422/429 handling
  - no Back navigation
  - honeypot field kept
  - top-window navigation for the EMAP handoff

  Never regenerate the form from prose.
- **EMAP calls run in client-only code** (see the violations table above).
- **Use literal attributes on every field** so `verify_form.py` can check them statically:
  - The `name` is the API field name (`ssn.1`).
  - The `id` is the name with dots as underscores (`ssn_1`).
  - Checkbox groups are named `key[]`.
  - Angular's `formControlName` counts as a name.
  - Accepted forms are `name="x"`, `name='x'` and JSX `name={"x"}`.
  - Attributes bound from a loop over a config array (`:name="f.key"`) can't be verified. Write
    the fields out.
- **Keep each `countryVariants` pattern as a literal string** in the validation code (a JS
  string with doubled backslashes is fine).
- **Keep every file of the form under one `form_dir`** that contains nothing else. `verify_form.py`
  scans that directory recursively for all frontend source types.
