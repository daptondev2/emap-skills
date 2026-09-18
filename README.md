# Easy Pay Direct Merchant Signup Skill

## What is this skill used for?

This skill is for **partners** who want to earn commission by referring merchants to [Easy Pay Direct](https://easypaydirect.com). Give it to your AI coding assistant and it builds a merchant signup form that you embed on your own website — in whichever of three ways fits your site (full form, redirect handoff, or email-based signup). Every merchant who signs up through your form is attributed to you via your partner key, so the signups you drive earn you a monthly residual commission for the lifetime of their account.

You don't need to handle any payment processing yourself. You just embed the form, send traffic to it, and earn.

## Installation

**What you'll need**

- **A partner API key (optional)** — it's what attributes signups to you for commission.
  - **Already a partner?** Log in to the partner portal → **Integration** → **API Integration** → copy the API key shown there.
  - **Not a partner yet?** Sign up at the [partner portal](https://emap.easypaydirect.com/signup/partner). Once registered, go to **Integration** → **API Integration** → copy the partner key.
  - You can also skip this and build without a key — signups will still work, just without commission attribution. You can add the key later.
- **An AI coding assistant**, any of them (Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, Windsurf, etc.). This is what actually builds the form from the skill. App builders like Replit, v0, etc. work too, as long as you can give them the `SKILL.md` contents to build from.
- **Python 3**, for the verification gate that checks the finished form against the schema. Most coding agents' environments have it. If yours doesn't (for example a browser-based app builder), run the check yourself on a machine that does.
- **Node.js**, only for the `npx` install method below; not needed if you copy the skill manually. Get it at [nodejs.org](https://nodejs.org).

> Not comfortable with a terminal? You can skip the commands entirely. Open your AI assistant, give it the skill (paste the link to `SKILL.md`), and ask it to build the form for you.

**1. Get the skill**

*Option A: `npx skills` (recommended)*

> **Before you run this, you need Node.js installed.** It's what provides the `npx` command. Download it from [nodejs.org](https://nodejs.org) (pick the "LTS" version and click through the installer), then reopen your terminal. To check it worked, run `node --version`; if it prints a version number you're set. If `npx` still isn't found after installing, close and reopen the terminal.

```bash
npx skills add daptondev2/emap-skills
```

*Option B: download it (no terminal needed)*

1. Click the green **Code** button → **Download ZIP**, then unzip it.
2. The skill is the `skills/emap-merchant-signup` folder inside. Point your agent at it (next step), or drop that folder wherever your agent reads skills from.

**2. Point your agent at it**

Agents that support skills pick it up from wherever they load skills. For any agent, you can also just point it at the file:

```
Build the signup form described in skills/emap-merchant-signup/SKILL.md.
```

`SKILL.md` is the single entry point. It links out to every other file the agent needs, so that one path is all you have to give it. If your agent works from a rules file instead (`AGENTS.md`, `.cursor/rules`, `.github/copilot-instructions.md`, etc.), copy `skills/emap-merchant-signup/AGENTS.md` into it. It tells the agent to follow `SKILL.md` and lists the rules that matter most.

## Answer the Gate Questions

Before it writes any code, the skill stops and asks:

1. **Which integration variant?** Asked in plain language, with exactly three options:

   1. **Full form** — the merchant fills out their entire application on your website, from start to finish. They never have to leave your site.
   2. **Redirect handoff** — the merchant only enters their basic contact info on your website. As soon as they submit that, they're automatically taken to Easy Pay Direct's own website to finish the rest of their application there.
   3. **Email-based signup** — the merchant enters their basic contact info on your website, and instead of being redirected, they get an email with a secure link to continue on Easy Pay Direct whenever they're ready.

2. **Do you have a partner API key?** Determines whether `partner_key` gets sent with the signup request, so the merchant is attributed to you.

   - **Yes** — log in to the partner portal → **Integration** → **API Integration** → copy the API key shown there, and paste it in when asked.
   - **No** — sign up at the [partner portal](https://emap.easypaydirect.com/signup/partner), then follow the same **Integration → API Integration** path once registered.
   - **Skip** — proceed without a key. Signups still work, just without commission attribution; the key is visible in the page's source once embedded, so skipping is also the option if you'd rather not have it there. See `references/security-checklist.md` for the full tradeoff.

The skill will not read reference files, open templates, or generate any code until both questions are asked and answered. It asks about your tech stack only if it can't detect it from your project's files. Agents with a multiple-choice question feature show these as options; others ask them in plain text.

## How the build is checked

Before writing the form, the agent copies a small verification gate into your project's `.emap/` folder. The form counts as done only when `python3 .emap/emap_gate.py` prints `PASS`. The gate re-checks the form against the schema itself instead of trusting the agent's word, and after 5 failed attempts it marks the build blocked so the agent reports the problems to you instead of looping. You can run the same command yourself or in CI. In Claude Code, the gate can also be installed as a Stop hook so the agent can't finish until it passes.

## Folder Structure

```
emap-skills/
├── README.md ........................................ This file
│
└── skills/
    └── emap-merchant-signup/ ........................ The skill
        ├── SKILL.md .................................. ⭐ Entry point: gate questions, navigation hub & spec
        ├── AGENTS.md ................................. Short rules for any agent; copy into a rules file if your agent has no skill support
        ├── signup-steps-schema.json .................. Machine-readable schema for all signup steps
        │
        ├── references/ ............................... Supporting docs, loaded on demand
        │   ├── field-catalog.md ...................... Full field list, types, and constraints
        │   ├── mode-1-fullform.md .................... Integration 1 (full form) API contract
        │   ├── mode-2-redirect.md .................... Integration 2 (redirect handoff) API contract
        │   ├── mode-3-api.md ......................... Integration 3 (email-based signup) API contract
        │   ├── api-errors.md ......................... HTTP status codes & error handling
        │   ├── api-quirks.md ......................... API behaviour the schema and EMAP's page don't make obvious
        │   ├── stack-guide.md ........................ Delivering the form in any stack (React, Vue, Angular, PHP, Rails, …)
        │   ├── security-checklist.md ................. Pre-launch security requirements
        │   └── dropdown-fallbacks.json ................ Static fallback data if a live dropdown call fails
        │
        ├── templates/ ................................ Ready-made code per integration mode — browser calls EMAP directly, any stack
        │   ├── integration-1/ ........................ Full form: README.md, plain-html.html, SignupForm.tsx (React component)
        │   ├── integration-2/ ........................ Redirect handoff: README.md, plain-html.html, SignupForm.tsx (React component)
        │   └── integration-3/ ........................ Email-based signup: README.md, plain-html.html, SignupForm.tsx (React component)
        │
        └── verify/ .................................... Deterministic, script-based build verification
            ├── README.md .............................. How to run it, what it checks, what it can't catch
            ├── scripts/
            │   ├── verify_form.py ..................... Checks the generated form against the schema — no LLM
            │   └── emap_gate.py ....................... Definition-of-done gate for any agent or CI (also a Claude Code Stop hook)
            └── hooks/
                └── claude-code-settings.json .......... Optional: registers the gate as a Claude Code Stop hook
```

This is the flat layout the `npx skills` CLI expects (`skills/<name>/SKILL.md`), so the skill under `skills/` here is installable with `npx skills add` out of the box.
