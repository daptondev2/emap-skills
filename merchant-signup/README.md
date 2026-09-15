# Merchant Signup Integration — Developer Guide

This skill helps you build a merchant signup form on your website that feeds into
Easy Pay Direct's (EMAP) onboarding system. Merchants fill in their basic business
info on your site; EMAP handles everything else (company details, banking, e-signature).

---

## Integration modes

| Mode | How it works | Backend required? |
|---|---|---|
| **Integration 1 — Full form** | Partner hosts all 6 steps; backend proxies each step to EMAP API | Yes |
| **Integration 2 — Redirect** | Browser redirects to EMAP `/signup` with step-1 data in URL params | No |
| **Integration 3 — API** | Your backend POSTs step-1 data to EMAP's REST API | Yes |

---

## Quick start: load the skill in your AI assistant

### Claude Code
```bash
# From your project directory, reference the skill directly
claude --context /path/to/signup-skills/merchant-signup/SKILL.md
```
Or tell the assistant: *"Load the skill at `signup-skills/merchant-signup/SKILL.md` and help me build an EMAP partner signup form."*

### Cursor / GitHub Copilot / Gemini CLI
Add `AGENTS.md` from this directory to your project root, or tell the assistant:
> "Load the skill at `signup-skills/merchant-signup/SKILL.md` and help me build an EMAP partner signup form."

### Plain chat (no file access)
Paste the full contents of `SKILL.md` into the chat, then describe your project stack. The assistant will guide you through the integration.

---

## Environment variables

Set these in `.env` (never commit `.env` to git):

| Variable | Required for | Description |
|---|---|---|
| `EMAP_BASE_URL` | All modes | EMAP host — `https://emap.epd.dev` (or staging URL from Easy Pay Direct) |
| `EMAP_PARTNER_KEY` | Integration 1, Integration 3 | Your partner `security_key` from EMAP — backend only, never in browser |
| `EMAP_PARTNER_SECRET_KEY` | Integration 2 | Same `security_key` value — added to redirect URL server-side |

---

## Available templates

```
templates/
  integration-1/
    plain-html.html     — complete 6-step form hosted on partner site
    node-express.js     — Express.js backend proxying all 6 steps to EMAP API
    nextjs-route.ts     — Next.js App Router route handlers for all 6 steps
    php-vanilla.php     — Plain PHP: serves the form + proxies all 6 steps
  integration-2/
    plain-html.html     — standalone HTML page, client-side redirect, no backend needed
    node-express.js     — Express.js server that builds the redirect URL server-side
    nextjs-route.ts     — Next.js App Router route handler for building redirect URL
    php-vanilla.php     — Plain PHP: renders form + builds redirect URL server-side
  integration-3/
    plain-html.html     — HTML form that POSTs JSON to your backend
    node-express.js     — Express.js backend proxy to EMAP API
    nextjs-route.ts     — Next.js App Router API route handler (TypeScript)
    php-vanilla.php     — Plain PHP: form + backend proxy in a single file
```

---

## Choosing a mode

**Use Integration 1 if:**
- You want to keep merchants on your domain for the entire 6-step signup
- You need full control over branding, layout, and copy on every step
- You have a backend server (Node, PHP, Python, etc.) and are comfortable proxying 6 API endpoints

**Use Integration 2 if:**
- You have a static site or CMS with no backend (Webflow, WordPress with no custom PHP, etc.)
- You want the fastest possible integration (a client-side HTML form is all you need)
- You're comfortable with PII appearing briefly in the URL and the merchant being redirected to EMAP

**Use Integration 3 if:**
- You have a backend server (Node, PHP, Python, etc.) or can add a serverless function
- You want a cleaner UX for step 1 (no browser redirect, show your own success/error messages)
- You need the `uuid` for your own records or CRM
- You want to implement the "Resend link" feature
- You're OK with the merchant continuing on EMAP from step 2 onward

---

## Testing

1. Set `EMAP_BASE_URL` to the EMAP staging URL provided by Easy Pay Direct.
2. **Integration 1:** Complete all 6 steps with test data. Verify Step 6 shows the success panel.
   Check that conditionals work: country=US shows state, ownership_percentage.1 < 51 shows Owner 2.
3. **Integration 2:** Submit the form. Verify you land on the EMAP signup page with fields pre-filled.
   For full auto-submit, include all non-excluded fields — the form should auto-submit and land on step 2.
4. **Integration 3:** Submit with a unique test email. Verify you receive `{"status":true,"uuid":"..."}`.
   Check that the welcome email arrives.

---

## Support

Contact Easy Pay Direct to:
- Obtain your partner key
- Get the staging environment URL
- Troubleshoot integration issues

---

## File structure

```
SKILL.md                     — AI assistant instructions (load this first)
AGENTS.md                    — Short pointer for Codex/Cursor/Copilot/Gemini
README.md                    — This file
references/
  field-catalog.md           — Complete step-1 field reference
  mode-1-fullform.md         — Integration 1 deep dive (all 6 steps)
  mode-2-redirect.md         — Integration 2 deep dive
  mode-3-api.md              — Integration 3 deep dive
  api-errors.md              — All error shapes and handling
  security-checklist.md      — Pre-launch security checklist
templates/
  integration-1/
    plain-html.html
    node-express.js
  integration-2/
    plain-html.html
    node-express.js
  integration-3/
    plain-html.html
    node-express.js
    php-vanilla.php
    nextjs-route.ts
```
