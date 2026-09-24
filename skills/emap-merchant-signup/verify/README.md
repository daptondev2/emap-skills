# Verify: schema conformance (script-based)

> **Definition of done.** A build is not done until the gate, `python3 .emap/emap_gate.py`, prints
> `PASS`. The gate runs `verify_form.py` itself; it never trusts a status you wrote. This applies to
> every agent. If your agent has a stop hook wired to the gate (SKILL.md Step 1), the hook enforces
> it automatically. Otherwise you run the gate yourself.

## Why a script, not an LLM read-through

Most of what needs checking here is a deterministic comparison: does field X in the generated code
match rule Y in `signup-steps-schema.json`? A script answers that in under a second with no LLM
involved at all — faster and more consistent than reading 150+ fields against a ~2,000-line schema
by hand. Reserve LLM/manual judgment for the class of bug a script genuinely can't catch (see "What
this script cannot catch" below).

## The loop

Commands run from the target project's root, using the copies installed by SKILL.md Step 1.

1. **Scripts read the inputs, not you.** `verify_form.py` loads the schema and the generated form
   files directly from disk.
2. **Run the gate after writing the form**, before telling the developer the build is done:
   ```
   python3 .emap/emap_gate.py
   ```
   It reads `.emap/build-state.json`, runs a full `verify_form.py` check of `form_dir`, and records
   the result there. Exit code 0 means verified (or nothing to check); 1 means findings.
3. **Read only the findings it prints.** Do not re-open the schema or the generated files to
   double-check its work; that defeats the point. Output is either `PASS`, `PASS (with
   advisories...)`, or a list of `[category:blocker]` / `[category:advisory]` lines, each with the
   field(s), what was expected, and what was actually found.
4. **Fix exactly the fields/lines named in the findings.** Only `blocker`-severity findings need to
   be resolved before the build is done. `advisory` findings are things the script structurally
   cannot verify (see below). Note them for the developer, don't chase them in a loop.
5. **Re-run scoped, not full**, after a fix. Call `verify_form.py` directly for this:
   ```
   python3 .emap/verify_form.py --form-dir <form_dir> --integration <n> --fields federal_tax_id,business_register_number
   python3 .emap/verify_form.py --form-dir <form_dir> --integration <n> --step 3
   python3 .emap/verify_form.py --form-dir <form_dir> --integration <n> --category conditional_logic
   ```
   Scoped runs skip the cache (see below) and check only what you asked for. They don't count as
   rounds. When they're clean, run the gate again.
6. **The gate caps the loop at 5 failing runs.** On the 5th failing gate run it sets `"status":
   "blocked"` and stores the findings in `.emap/build-state.json`. Stop fixing then, and report
   exactly those findings to the developer instead of claiming the build is done. To resume later,
   set `"status"` back to `"in_progress"` and `"rounds"` to `0`.
7. **Gate prints `PASS` → done.** It sets `"status": "verified"` itself. You don't write that.
8. **Abandoning a build?** Write `"status": "cancelled"` to `.emap/build-state.json` rather than
   leaving it `"in_progress"` (which keeps a stop hook re-checking a build nobody is finishing) or
   deleting or hand-editing the file to fake a pass.

Then move on to [`../references/security-checklist.md`](../references/security-checklist.md).
These scripts check schema conformance only, not deployment/security wiring.

## What it checks

| Category | Checks |
|---|---|
| `widget_type` | the rendered widget matches the schema's `type` (a `checkbox-group`/`radio` field wasn't rendered as a `<select>`, etc.); every `staticDropdowns`-backed field renders the option `label` text, not the raw `value`/`slug` |
| `country_validation` | every `countryVariants.<country>.pattern` appears verbatim somewhere in the frontend code (or the optional `--backend` file) — not just as a hint/placeholder; a JS string with doubled backslashes counts |
| `conditional_logic` | every `dependsOn`/`visibleIf` field's controlling field id and comparison value are referenced together in the form's JS — inline `<script>` blocks, component code, or JS held in string constants (not just nearby in HTML markup) |
| `dropdown_route` | every `dynamicDropdownEndpoints` entry that integration uses is fetched directly from the browser (no server proxy), and an embedded fallback dataset with real rows exists: at least 150 country `code` rows and 50 industry-type `slug` rows, copied from `references/dropdown-fallbacks.json`. A one-row stub fails. Integration 1 uses all six endpoints, Integration 2 uses countries/states/industry types, Integration 3 uses countries/industry types |
| `error_handling` | Integrations 1 and 3, which `POST` to EMAP, compare the response status to `429` and `422` explicitly, so a rate limit or a validation error isn't shown as a generic failure. Integration 2 doesn't call the API and is skipped. A textual check: it confirms the branches exist, not what they show |

**Integration-aware scope.** `--integration 2` and `--integration 3` check Step 1 fields only
(that's all those modes render — see SKILL.md's Integration 2/3 sections); `dropdown_route` checks
only the endpoints that integration fetches; `error_handling` skips Integration 2. `dropdown_route`
and `error_handling` run only on unscoped runs or with `--category`, not with `--step`/`--fields`.
Step 1's field definitions are shared across all
three integration modes, so this is just `--step 1` under the hood — no separate field list to
maintain.

**Which files it reads.** The form can be written in any stack. The script scans `--form-dir`
recursively for component files (`.js .jsx .mjs .cjs .ts .tsx .vue .svelte .astro`) and
template files (`.html .htm .php .erb .twig .liquid .hbs .njk .ejs .cshtml .razor .jinja`, etc.),
skipping dependency, build and test output (`node_modules`, `dist`, `build`, `.next`, `.nuxt`,
`vendor`, `*.test.*`, `*.spec.*`, `*.stories.*`, `*.d.ts`). So keep `form_dir` form-only. To point
at specific files instead, repeat `--frontend FILE`. Fields must use literal attributes
(`name="ssn.1"`, `id="ssn_1"`, JSX `name={"ssn.1"}`, Angular `formControlName`); names bound from a
loop over a config array can't be checked statically. See
[`../references/stack-guide.md`](../references/stack-guide.md#porting-rules-for-any-native-port).

**Caching.** A full, unscoped run records a fingerprint of the schema + form files, plus
pass/fail, in `.emap/verify-cache.json`. That happens only when the script runs from the installed
`.emap/` copy (the gate and the commands above), or when you pass `--cache-file PATH`. Run from
anywhere else, it caches nothing and never writes into the form's folder. If nothing has changed
since the last passing run, the next full run prints `PASS (cached...)` and exits immediately instead of
re-checking 150+ fields again. Scoped runs (`--step`/`--fields`/`--category`) always run fresh and
never read or write the cache. Pass `--no-cache` to force a fresh full run.

## What this script cannot catch

Be honest with the developer about this rather than implying a clean `PASS` means the form is
bug-free — it means the form matches the schema, which is not the same thing as the schema being
right:

- **The schema and the generated code agreeing with each other, while both are wrong relative to
  the live API.** This actually happened: `federal_tax_id`'s Sole-Proprietorship exemption and
  `business_register_number`'s Puerto Rico/CA-sole-prop exemption were both documented in the
  schema *and* correctly implemented in the code *and* still 422'd against the live API, because
  EMAP's real validation doesn't grant those exemptions (see
  [`../references/api-quirks.md`](../references/api-quirks.md)). No schema-vs-code diff can catch
  this; only a real POST to the API can. If you need this level of confidence, run one 6-step
  submission for a representative edge case (e.g. a non-CA Sole-Proprietorship) against EMAP's
  **test server** with an email address you control. Never create test applications on
  production.
- **Semantic/case-sensitivity bugs in a comparison that still references the right names.** e.g.
  `industry_type === 'other'` vs `.toLowerCase() === 'other'` — both versions reference the same
  field and the same comparison value, so a text-proximity check can't distinguish "compared
  correctly" from "compared with the wrong case." The script can tell you the wiring exists; it
  can't grade whether the comparison inside it is correct.
- **`hear_about_us_other`'s condition specifically** — its schema entry is a prose `note`, not a
  structured `field`/`value`/`logic`, so there's nothing for the script to compare textually. It
  always reports as an `advisory`, every run, for every build. This is expected, not a regression.
- **Anything not in the schema at all** — deployment config, security headers, partner-key
  handling. That's what [`../references/security-checklist.md`](../references/security-checklist.md)
  is for.

## Why the gate re-runs the script instead of trusting the state file

`emap_gate.py` never accepts a `"status": "verified"` that someone wrote into
`.emap/build-state.json`. Every run re-runs `verify_form.py` against the tracked build and sets the
status from that result. A self-reported status can be wrong: someone forgot to re-run after a late
edit, or just asserted it. The script takes well under a second (see Time budget below), so
re-checking costs nothing.

The same property holds when an agent hook calls the gate. The Claude Code Stop hook
(`--claude-stop-hook`) blocks the agent from finishing while the gate fails, and lets it finish
once the gate passes or the build is `blocked` or `cancelled`. The 5-round cap guarantees the hook
can't block forever.

## Time budget

| Step | Time |
|---|---|
| Full script run (150+ fields) | < 1s |
| Fix findings (you, editing code) | 1–2 min |
| Scoped re-run(s) | < 1s each |
| Final gate run | < 1s |
| **Total** | **~1–2 min** |
