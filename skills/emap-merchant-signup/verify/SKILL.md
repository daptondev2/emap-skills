# Verify: schema conformance (script-based)

> **Definition of done.** A build is not done until `verify_form.py` passes (`PASS`, no
> `blocker`-severity findings). If the Stop hook (Step 1) is installed, the session cannot Stop
> until it passes — the hook runs the script itself, it does not trust a self-reported status.

## Why a script, not an LLM read-through

Most of what needs checking here is a deterministic comparison: does field X in the generated code
match rule Y in `signup-steps-schema.json`? A script answers that in under a second with no LLM
involved at all — faster and more consistent than reading 150+ fields against a ~2,000-line schema
by hand. Reserve LLM/manual judgment for the class of bug a script genuinely can't catch (see "What
this script cannot catch" below).

## The loop

1. **Script reads the inputs, not you.** `verify_form.py` loads the schema and the generated form
   files directly from disk.
2. **Run it after writing the form/backend**, before telling the developer the build is done:
   ```
   python3 verify/scripts/verify_form.py --form-dir <path to the generated form> --integration <1|2|3>
   ```
   No arguments needed beyond that if run from within this skill's checkout — it finds
   `signup-steps-schema.json` automatically. Add `--schema <path>` explicitly if running a copy
   installed elsewhere (see Step 1).
3. **Read only the findings it prints** — do not re-open the schema or the generated files to
   double-check its work; that defeats the point. Output is either `PASS`, `PASS (with
   advisories...)`, or a list of `[category:blocker]` / `[category:advisory]` lines, each with the
   field(s), what was expected, and what was actually found.
4. **Fix exactly the fields/lines named in the findings.** Only `blocker`-severity findings need to
   be resolved before the build is done; `advisory` findings are things the script structurally
   cannot verify (see below) — note them for the developer, don't chase them in a loop.
5. **Re-run scoped, not full**, after a fix:
   ```
   python3 verify_form.py --form-dir <path> --fields federal_tax_id,business_register_number
   python3 verify_form.py --form-dir <path> --step 3
   python3 verify_form.py --form-dir <path> --category conditional_logic
   ```
   Scoped runs skip the cache (see below) and check only what you asked for.
6. **Cap at 5 verify → fix rounds.** If `blocker` findings remain after 5 rounds, stop looping.
   Write `.claude/emap-build-state.json`:
   ```json
   { "status": "blocked", "integration": "1", "form_dir": "merchant-signup", "rounds": 5, "findings": [ /* the script's last JSON output, --json */ ] }
   ```
   and report exactly those findings to the developer instead of claiming the build is done.
7. **Zero `blocker` findings → done.** Write:
   ```json
   { "status": "verified", "integration": "1", "form_dir": "merchant-signup" }
   ```
   (The Stop hook, if installed, will re-run the script itself and correct this file automatically
   if it disagrees — see "Why the hook re-runs the script" below.)
8. **Abandoning a build?** Write `{"status": "cancelled", "integration": "<n>", "form_dir": "..."}`
   rather than leaving it `"in_progress"` (which would leave the Stop hook blocking forever) or
   deleting/hand-editing the file to fake a pass.

Then move on to [`../references/security-checklist.md`](../references/security-checklist.md) —
this script checks schema conformance only, not deployment/security wiring.

## What it checks

| Category | Checks |
|---|---|
| `widget_type` | the rendered widget matches the schema's `type` (a `checkbox-group`/`radio` field wasn't rendered as a `<select>`, etc.); every `staticDropdowns`-backed field renders the option `label` text, not the raw `value`/`slug` |
| `country_validation` | every `countryVariants.<country>.pattern` appears verbatim somewhere in the frontend or backend code — not just as a hint/placeholder |
| `conditional_logic` | every `dependsOn`/`visibleIf` field's controlling field id and comparison value are referenced together in the actual `<script>` wiring (not just nearby in HTML markup); no Back button/back-navigation exists anywhere |
| `dropdown_route` | every `dynamicDropdownEndpoints` entry has a matching route in the backend, with a fallback reference (Integration 1 only — 2 and 3 don't have a dropdown-proxy backend in this sense) |

**Integration-aware scope.** `--integration 2` and `--integration 3` check Step 1 fields only
(that's all those modes render — see SKILL.md's Integration 2/3 sections) and skip
`dropdown_route`. Step 1's field definitions are shared across all three integration modes, so this
is just `--step 1` under the hood — no separate field list to maintain.

**Caching.** A full, unscoped run writes `.emap_verify_cache.json` next to the generated form (a
fingerprint of the schema + form files, plus pass/fail). If nothing has changed since the last
passing run, the next full run prints `PASS (cached...)` and exits immediately instead of
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
  EMAP's real validation doesn't grant those exemptions (see SKILL.md point 7's callout). No
  schema-vs-code diff can catch this — only a real POST to the live API can. If you need this level
  of confidence and have a few minutes of budget, run one live 6-step submission for a
  representative edge case (e.g. a non-CA Sole-Proprietorship) rather than trusting a clean script
  run alone.
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
- **Wire-format/payload-shape bugs.** The script confirms a field's id/name exists in the markup
  and is wired to the right JS logic — it does not simulate an actual submission or inspect what
  shape gets sent over the wire. Step 4 (`POST /api/v1/ownership`) is a real example: the field
  *names* are dot-notation (`first_name.1`), but the API only accepts them sent as **nested JSON
  objects** (`{"first_name": {"1": "..."}}`) — sending literal flat dotted keys gets every field
  rejected as `"required"`. The templates' `toNestedDot()` helper already does this correctly, but
  a script check on field ids alone can't tell a correctly-nested payload from an incorrectly-flat
  one; only a real POST to the live API can. See `references/mode-1-fullform.md`'s Step 4 section.

## Why the hook re-runs the script instead of trusting the state file

`emap_stop_gate.py` (Step 1) does not just check `.claude/emap-build-state.json`'s `"status"`
field and let a build agent's own "verified" claim through — it re-runs `verify_form.py` itself,
every time a Stop is attempted while a build is tracked as `in_progress` or `verified`, and only
allows the stop if that run genuinely passes right now. This is deliberate: a self-reported status
field can be wrong (forgotten to re-run after a late edit, or just asserted). The script is cheap
enough (well under a second, see Time budget below) that there's no real cost to re-checking
instead of trusting.

## Time budget

| Step | Time |
|---|---|
| Full script run (150+ fields) | < 1s |
| Fix findings (you, editing code) | 1–2 min |
| Scoped re-run(s) | < 1s each |
| Final full run + hook check | < 1s |
| **Total** | **~1–2 min** |
