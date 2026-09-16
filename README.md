# EMAP Merchant Signup Skill

## What is this skill used for?

This skill is for **partners** who want to earn commission by referring merchants to [Easy Pay Direct (EMAP)](https://easypaydirect.com). Give it to your AI coding assistant and it builds a merchant signup form that you embed on your own website — in whichever of three ways fits your site (full form, redirect handoff, or email-based signup). Every merchant who signs up through your form is attributed to you via your partner key, so the signups you drive earn you a monthly residual commission for the lifetime of their account.

You don't need to handle any payment processing yourself. You just embed the form, send traffic to it, and earn.

## Installation

**What you'll need**

- **A partner API key (optional)**, from the [EMAP partner portal](https://emap.easypaydirect.com/signup/partner). It's what attributes signups to you for commission.
- **An AI coding assistant** (Claude Code, Cursor, etc.). This is what actually builds the form from the skill. App builders like Replit, v0, etc. work too, as long as you can give them the `SKILL.md` contents to build from.
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

Tell your AI assistant to build the form from `SKILL.md`. A few examples:

*Claude:*
```
Build the signup form using this specification: skills/emap-merchant-signup/SKILL.md
```

*Any other agent:*
```
Generate the signup form described in skills/emap-merchant-signup/SKILL.md.
```

`SKILL.md` is the single entry point. It links out to every other file the agent needs, so that one path is all you have to give it.

## Answer the Gate Questions

Before it writes any code, the skill stops and asks:

1. **Which integration variant?** Asked in plain language, with exactly three options:

   1. **Full form** — the merchant fills out their entire application on your website, from start to finish. They never have to leave your site. Requires a backend.
   2. **Redirect handoff** — the merchant only enters their basic contact info on your website. As soon as they submit that, they're automatically taken to EMAP's own website to finish the rest of their application there. No backend required.
   3. **Email-based signup** — the merchant enters their basic contact info on your website, and instead of being redirected, they get an email with a secure link to continue on EMAP whenever they're ready. Requires a backend.

2. **Do you have a partner API key?** Determines whether `partner_key` gets sent with the signup request, so the merchant is attributed to you. You can provide a key, sign up for one, or skip and proceed without attribution.

The skill will not read reference files, open templates, or generate any code until both questions are asked and answered.

## Folder Structure

```
emap-skills/
├── README.md ........................................ This file
│
└── skills/
    └── emap-merchant-signup/ ........................ The skill
        ├── SKILL.md .................................. ⭐ Entry point: gate questions, navigation hub & spec
        ├── AGENTS.md ................................. Agent-specific operating notes
        ├── signup-steps-schema.json .................. Machine-readable schema for all signup steps
        │
        ├── references/ ............................... Supporting docs, loaded on demand
        │   ├── field-catalog.md ...................... Full field list, types, and constraints
        │   ├── mode-1-fullform.md .................... Integration 1 (full form) API contract
        │   ├── mode-2-redirect.md .................... Integration 2 (redirect handoff) API contract
        │   ├── mode-3-api.md ......................... Integration 3 (email-based signup) API contract
        │   ├── api-errors.md ......................... HTTP status codes & error handling
        │   └── security-checklist.md ................. Pre-launch security requirements
        │
        └── templates/ ................................ Ready-made code per integration mode
            ├── integration-1/ ........................ Full form: plain-html, PHP, Node, Next.js
            ├── integration-2/ ........................ Redirect handoff: plain-html, PHP, Node, Next.js
            └── integration-3/ ........................ Email-based signup: plain-html, PHP, Node, Next.js
```

This is the flat layout the `npx skills` CLI expects (`skills/<name>/SKILL.md`), so the skill under `skills/` here is installable with `npx skills add` out of the box.
