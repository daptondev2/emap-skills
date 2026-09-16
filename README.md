# EMAP Merchant Signup Skill

## What is this?

[Easy Pay Direct (EMAP)](https://easypaydirect.com) is a payment processing platform for high-risk and e-commerce merchants. As an **EMAP partner**, you earn residual commissions every month for every merchant you refer — for the lifetime of their account.

This skill gives you everything you need to **embed a merchant signup form on your own website**, so merchants can apply directly through your site. When they're approved and start processing payments, EMAP pays you a commission automatically.

You don't need to handle any payment processing yourself. You just embed the form, send traffic to it, and earn.

---

## How it works

1. A merchant visits your website and fills in their business details through your branded signup form.
2. Their application is submitted to Easy Pay Direct.
3. Easy Pay Direct reviews and approves the merchant.
4. The merchant starts processing credit cards through EMAP.
5. **You receive a monthly residual commission** for as long as they're a customer.

---

## Before you start

### Step 1 — Become an EMAP partner

If you're not already a partner, sign up at:
**https://emap.easypaydirect.com/signup/partner**

Once registered, log in to the partner portal and navigate to:
**Integration → API Integration**

Copy your **Partner API Key** — you'll need it to link signups to your account.

> Without a partner key, the signup form still works but applications won't be attributed to you. You won't earn commissions on unattributed signups.

### Step 2 — Choose how you want to embed the form

There are three ways to integrate, depending on how your website is built:

| Option | Best for | Requires |
|---|---|---|
| **Full Form (Integration 1)** | Full branding control — merchant stays on your site for all 6 steps | A backend server (PHP, Node.js, etc.) |
| **Redirect (Integration 2)** | Static sites or quick setup — merchant is sent to EMAP to finish | Nothing — just HTML |
| **Email Signup (Integration 3)** | You collect their info, EMAP emails them a link to finish | A backend server |

**Not sure which to pick?**
- Static website (Webflow, Squarespace, no backend) → use **Integration 2**
- WordPress, custom PHP, Node.js, or any server → use **Integration 3** (easiest with a backend) or **Integration 1** (most control)

---

## Installation

### Option A — Use with an AI coding assistant (recommended)

This skill is designed to be used with an AI coding assistant (Claude, Copilot, Cursor, Gemini, etc.). Load the skill file and ask the assistant to build the form for you.

**Step 1: Install the skill**

From your project folder, run:
```bash
npx skills add daptondev2/emap-skills
```

This installs the `emap-merchant-signup` skill for your AI assistant. Useful options:
- `-g` — install globally instead of just for the current project
- `-a claude-code` (or `cursor`, `codex`, …) — install for a specific assistant

Not using the `skills` CLI? Clone the repo instead and point your assistant at `skills/emap-merchant-signup/SKILL.md`:
```bash
git clone https://github.com/daptondev2/emap-skills.git
```

**Step 2: Ask your AI assistant to build the form**

In your AI assistant chat, say:
> "Use the emap-merchant-signup skill to build me an EMAP partner signup form for my [PHP / Node.js / static HTML] project. My partner key is `YOUR_PARTNER_KEY_HERE`."

The assistant will ask you a few questions and then generate the complete signup form for your tech stack.

**Step 3: Add your environment variables**

Create a `.env` file in your project (never commit this to git):
```
EMAP_BASE_URL=https://emap.epd.dev
EMAP_PARTNER_KEY=your_partner_key_here
```

**Step 4: Deploy and test**

Submit a test application using the staging URL from Easy Pay Direct, then go live.

---

### Option B — Copy a ready-made template

If you'd rather skip the AI assistant, grab a template directly:

```
skills/emap-merchant-signup/templates/
  integration-1/        ← Full 6-step form on your site
    plain-html.html     → Copy this HTML file and style it
    php-vanilla.php     → Drop-in PHP backend (no framework needed)
    node-express.js     → Express.js backend
    nextjs-route.ts     → Next.js App Router

  integration-2/        ← Redirect to EMAP after step 1
    plain-html.html     → Self-contained HTML, no backend needed
    php-vanilla.php     → PHP variant
    node-express.js     → Express.js variant

  integration-3/        ← Email link sent to merchant after step 1
    plain-html.html     → HTML form
    php-vanilla.php     → Drop-in PHP backend
    node-express.js     → Express.js backend
    nextjs-route.ts     → Next.js App Router
```

Open the template for your integration mode and tech stack. Follow the comments at the top of the file — they explain exactly what environment variables to set and how to deploy.

---

## What the merchant sees

### Integration 1 — Full 6-step form
The merchant completes their entire application on **your website**:

1. **Step 1 — Business Basics** — name, email, phone, company, website, country, annual sales, industry
2. **Step 2 — Company Info** — legal structure, address, EIN, revenue model
3. **Step 3 — Products** — fulfillment method, shopping cart, transaction amounts, product description
4. **Step 4 — Owners** — owner identity, SSN/SIN (or equivalent), date of birth, ownership percentage
5. **Step 5 — Banking** — routing number, account number (labels adapt to the merchant's country)
6. **Step 6 — Final Details** — referral source, terms acceptance

At the end, they see a confirmation panel with a reference number and you receive attribution in your EMAP partner account.

### Integration 2 — Quick redirect
The merchant fills in step-1 details on your site, then clicks **Continue**. They're redirected to EMAP's secure onboarding to complete the rest. Takes about 2 minutes to set up.

### Integration 3 — Email link
The merchant fills in step-1 details on your site and clicks **Send Signup Link**. They receive an email from EMAP with a secure link to complete the rest of their application at their convenience.

---

## Country support

The form supports merchants from any country. Fields and labels automatically adapt:

| Country | SSN field label | Routing number label | Account number label |
|---|---|---|---|
| United States | SSN / SIN | Routing Number | Account Number |
| Canada | SSN / SIN | Transit Number / Routing Number | Account Number |
| Australia | Personal Tax ID | BSB Code | Account Number |
| United Kingdom | Personal Tax ID | Sort Code | Account Number |
| Other countries | Personal Tax ID / Gov ID | BIC Code / SWIFT Code | IBAN / Account Number |

---

## Earning commissions

Once a merchant you referred is approved:
- EMAP pays you a **monthly residual** on their processing volume
- Commissions are tracked in your EMAP partner portal
- You can view your referrals, their status, and your earnings at any time

The more merchants you refer, the more you earn — and commissions are paid for the lifetime of each merchant account.

Log in to the partner portal to see your dashboard:
**https://emap.easypaydirect.com/login/partner**

---

## Testing

Before going live, test with EMAP's staging environment:

1. Get the staging URL from Easy Pay Direct (ask your partner manager or email newclients@easypaydirect.com)
2. Set `EMAP_BASE_URL` in your `.env` to the staging URL
3. Submit a test application with fake data
4. Confirm you see the success screen (Integration 1) or receive the email (Integration 3)
5. Check your partner portal to confirm the test application appears under your account

---

## Getting your partner key

| Where to get it | Steps |
|---|---|
| Already registered | Log in → Integration → API Integration → copy the key |
| Not yet a partner | Sign up at https://emap.easypaydirect.com/signup/partner, then follow the steps above |
| Lost your key | Log in → Integration → API Integration (the key is always visible there) |

---

## Support

- **Partner portal:** https://emap.easypaydirect.com/login/partner
- **Email:** newclients@easypaydirect.com
- **Phone:** +1 (800) 805-4949

For technical questions about this integration skill, open an issue in this repository.
