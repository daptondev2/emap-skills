#!/usr/bin/env python3
"""
verify_form.py — deterministic schema-conformance checker for a generated
EMAP merchant-signup form. No LLM involved: reads signup-steps-schema.json
and the generated form files directly, and reports mismatches.

Stack-agnostic: every frontend source file under --form-dir is scanned
(HTML, JS/TS/JSX/TSX, Vue, Svelte, Astro, and server-rendered template
formats such as PHP, ERB, Twig, Liquid, Jinja, Razor, EJS, Handlebars).
Markup embedded in long JS string literals (as in templates/*/SignupForm.tsx)
is decoded and checked too.

Checks 5 categories:
  widget_type    — rendered widget matches the schema's `type`, and any
                    hardcoded (staticDropdowns) field renders the option
                    `label`, not the raw `value`/`slug`.
  country_validation — every countryVariants `pattern` is present verbatim
                    somewhere in the form's validation code, not just shown
                    as a hint/placeholder.
  conditional_logic — every dependsOn/visibleIf field has its controlling
                    field id and comparison value referenced near its own
                    show/hide/require code, and no Back-navigation exists.
  dropdown_route — every dynamicDropdownEndpoints entry the integration uses
                    is fetched directly from the browser, and an embedded
                    fallback dataset (real rows, not just the word) exists.
  error_handling — Integrations 1 and 3 (which POST to EMAP) handle HTTP 429
                    and 422 explicitly.

Usage:
  verify_form.py [--schema PATH] [--form-dir DIR] [--frontend FILE ...]
                  [--backend FILE] [--integration {1,2,3}]
                  [--category {widget_type,country_validation,conditional_logic,dropdown_route,error_handling}]
                  [--step N] [--fields a,b,c] [--json] [--no-cache]
                  [--cache-file PATH]

Exit code: 0 if PASS (no findings), 1 if findings exist, 2 on a usage/setup error.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
# Same file the gate passes via --cache-file, so an installed copy shares it.
CACHE_FILE_NAME = "verify-cache.json"
CATEGORIES = ["widget_type", "country_validation", "conditional_logic", "dropdown_route", "error_handling"]


def default_cache_path():
    """Only an installed copy (in the target project's .emap/ folder) caches
    by default, next to itself. Run from anywhere else, it never writes into
    the form's folder: no cache unless --cache-file is given."""
    return SCRIPT_DIR / CACHE_FILE_NAME if SCRIPT_DIR.name == ".emap" else None


def default_schema_path() -> Path:
    """This script lives in two layouts: inside the skill repo at
    verify/scripts/verify_form.py (schema two levels up), or copied next to
    the schema itself into a target project's .emap/ folder (schema in the
    same directory, per SKILL.md Step 1). Try both, same-directory first since
    that's where an installed copy expects it."""
    same_dir = SCRIPT_DIR / "signup-steps-schema.json"
    if same_dir.exists():
        return same_dir
    return SCRIPT_DIR.parent.parent / "signup-steps-schema.json"


DEFAULT_SCHEMA = default_schema_path()

# Fields whose widget type is a checkbox-group (send an array), never a <select>.
CHECKBOX_GROUP_TYPES = {"checkbox-group"}
RADIO_TYPES = {"radio"}
CHECKBOX_TYPES = {"checkbox"}
SELECT_TYPES = {"select"}
TEXTAREA_TYPES = {"textarea"}
# Everything else (text, tel, email, number, date, url, hidden) is a plain <input>.

WINDOW_LINES = 40  # how many lines apart two references may be and still count as "wired together"

# Frontend source formats scanned under --form-dir. The form may be built in
# any client-side stack; what matters is that the EMAP calls happen in the
# browser (see SKILL.md Step 0), not which framework renders the markup.
COMPONENT_EXTS = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".vue", ".svelte", ".astro"}
TEMPLATE_EXTS = {
    ".html", ".htm", ".php", ".erb", ".twig", ".liquid", ".hbs", ".handlebars", ".njk",
    ".ejs", ".cshtml", ".razor", ".jinja", ".jinja2", ".j2", ".mustache",
}
FRONTEND_EXTS = COMPONENT_EXTS | TEMPLATE_EXTS
SKIP_DIRS = {
    "node_modules", ".git", ".next", ".nuxt", ".svelte-kit", ".output", ".astro", ".turbo",
    ".cache", "dist", "build", "out", "coverage", "vendor", "__pycache__",
}
# Test/story/type-declaration files mention field names without wiring them
# up — scanning them would let a broken form false-pass.
SKIP_FILE_RE = re.compile(r"\.(test|spec|stories)\.[^.]+$|\.d\.ts$")

# A long double-quoted JS string literal — how templates/*/SignupForm.tsx
# embeds its markup and logic (JSON-escaped). Decoded before checking.
LONG_JS_STRING_RE = re.compile(r'"(?:[^"\\\n]|\\.){200,}"')
# A decoded literal counts as script (for conditional_logic) only if it reads
# like JS and isn't a markup blob — logic that builds a few HTML strings is
# still logic; the FORM_HTML constant (starts with a tag) is not.
JS_CODE_RE = re.compile(r"\bfunction\b|=>|\b(?:const|let|var)\s+\w+\s*=|addEventListener")

# Gap allowed between a tag name and one of its attributes. Not [^>]* —
# JSX attributes often contain "=>" (onChange={e => ...}).
TAG_GAP = r"[^<]*?"

# Schema dependsOn/visibleIf conditions sometimes reference a synthetic
# concept name instead of a literal field id/payload key — see the comment
# where this is used in check_conditional_logic.
SYNTHETIC_TOKEN_ALIASES = {
    "country_from_step1": ["step1Country"],
}


# ── Schema loading / flattening ────────────────────────────────────────────

def load_schema(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"ERROR: schema file not found at {path}", file=sys.stderr)
        sys.exit(2)
    except json.JSONDecodeError as e:
        print(f"ERROR: schema file is not valid JSON: {e}", file=sys.stderr)
        sys.exit(2)


def flatten_fields(fields: list, step: int) -> list:
    """Step 4's field list nests Owner 1 / Owner 2 sections as
    {"section": ..., "fields": [...]} instead of a flat field dict — recurse
    into those so every leaf field is returned as one flat list."""
    out = []
    for f in fields:
        if "key" in f:
            f = dict(f)
            f["step"] = step
            out.append(f)
        elif "fields" in f:
            out.extend(flatten_fields(f["fields"], step))
    return out


def all_fields(schema: dict) -> list:
    out = []
    for step_obj in schema.get("steps", []):
        out.extend(flatten_fields(step_obj.get("fields", []), step_obj["step"]))
    return out


# ── HTML/JS id helpers ─────────────────────────────────────────────────────

def extract_script_lines(html_text: str) -> list:
    """conditional_logic must be checked against actual JS wiring, not just
    proximity in the HTML markup — two related fields (e.g. a select and its
    "other" text input) commonly sit right next to each other in the markup
    with zero JS connecting them, which would otherwise false-pass. Pull out
    only the content of inline <script> blocks (skip external <script src=...>
    tags with no body) and return it as its own line list."""
    blocks = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", html_text, flags=re.S)
    inline = [b for b in blocks if b.strip()]
    return "\n".join(inline).splitlines()


def html_id_variants(key: str) -> list:
    """A schema field key like 'ssn.1' is commonly rendered with id="ssn_1"
    (dots -> underscores) while the `name` attribute keeps the dot, per the
    skill's own templates. Return every spelling worth searching for."""
    variants = {key}
    if "." in key:
        variants.add(key.replace(".", "_"))
    if "[]" not in key:
        variants.add(key + "[]")
    if key in FIELD_KEY_ALIASES:
        variants.update(FIELD_KEY_ALIASES[key])
    return list(variants)


# The schema's field `key` is the API field name, which is not always what
# the local HTML input is id'd/named — every template here deliberately
# renders Step 1's company-name field as id="company_name" (for label/UX
# clarity) and remaps it to the API's `name` field only at submit time. Both
# spellings are legitimate; check either.
FIELD_KEY_ALIASES = {
    "name": ["company_name"],
}


def find_line_numbers(text_lines: list, needle: str) -> list:
    return [i for i, line in enumerate(text_lines) if needle in line]


def any_pair_within_window(lines_a: list, lines_b: list, window: int) -> bool:
    if not lines_a or not lines_b:
        return False
    for a in lines_a:
        for b in lines_b:
            if abs(a - b) <= window:
                return True
    return False


# ── Category A: widget_type / hardcoded_label ──────────────────────────────

def attr_re(attr_names: str, values: list) -> str:
    """Regex for an attribute assignment in any common template syntax:
    name="x", name='x', or JSX's name={"x"} / name={'x'} / name={`x`}.
    `attr_names` is a regex alternation (e.g. "id|name")."""
    v = "|".join(re.escape(x) for x in values)
    return (rf'\b(?:{attr_names})\s*=\s*'
            rf'(?:"(?:{v})"|\'(?:{v})\'|\{{\s*["\'`](?:{v})["\'`]\s*\}})')


# Attribute names that identify a form control across stacks: plain HTML
# id/name, plus Angular reactive forms' formControlName.
ID_ATTRS = "id|name|formControlName"


def check_widget_type(field: dict, frontend_text: str, schema: dict) -> list:
    findings = []
    key = field["key"]
    ftype = field.get("type")
    if ftype in ("hidden",):
        return findings  # hidden fields aren't user-facing widgets, nothing to render-check

    ids = html_id_variants(key)
    id_attr = attr_re(ID_ATTRS, ids)
    name_attr = attr_re("name|formControlName", [key, key + "[]"])
    type_checkbox = attr_re("type", ["checkbox"])
    type_radio = attr_re("type", ["radio"])

    def present(pattern: str) -> bool:
        return re.search(pattern, frontend_text) is not None

    def tag_with(tag: str, attr: str) -> bool:
        return present(rf"<{tag}\b{TAG_GAP}{attr}")

    def both_attrs(a: str, b: str) -> bool:
        return present(rf"{a}{TAG_GAP}{b}") or present(rf"{b}{TAG_GAP}{a}")

    if ftype in SELECT_TYPES:
        if not tag_with("select", id_attr):
            findings.append(_finding(field, "widget_type",
                f"expected a <select> for '{key}'", "no matching <select> found"))
    elif ftype in CHECKBOX_GROUP_TYPES:
        if not both_attrs(type_checkbox, name_attr):
            findings.append(_finding(field, "widget_type",
                f"expected a checkbox-group for '{key}' (multiple type=\"checkbox\" inputs named '{key}[]')",
                "no matching checkbox-group found"))
        if tag_with("select", id_attr):
            findings.append(_finding(field, "widget_type",
                f"'{key}' is a checkbox-group in the schema", "rendered as a <select> instead"))
    elif ftype in RADIO_TYPES:
        if not both_attrs(type_radio, name_attr):
            findings.append(_finding(field, "widget_type",
                f"expected radio buttons for '{key}'", "no matching type=\"radio\" inputs found"))
        if tag_with("select", id_attr):
            findings.append(_finding(field, "widget_type",
                f"'{key}' is radio (Yes/No) in the schema", "rendered as a <select> instead"))
    elif ftype in CHECKBOX_TYPES:
        if not both_attrs(type_checkbox, id_attr):
            findings.append(_finding(field, "widget_type",
                f"expected a single checkbox for '{key}'", "no matching type=\"checkbox\" input found"))
    elif ftype in TEXTAREA_TYPES:
        if not tag_with("textarea", id_attr):
            findings.append(_finding(field, "widget_type",
                f"expected a <textarea> for '{key}'", "no matching <textarea> found"))
    else:
        # text / tel / email / number / date / url and anything else -> plain <input>
        if not tag_with("input", id_attr):
            findings.append(_finding(field, "widget_type",
                f"expected an <input> for '{key}' (type={ftype})", "no matching <input> found"))

    # Hardcoded-label check: a staticDropdowns-backed field must render the
    # human label, not the raw slug/value, for every option.
    options_source = field.get("optionsSource", "")
    if options_source.startswith("staticDropdowns."):
        dropdown_key = options_source.split(".", 1)[1]
        options = schema.get("staticDropdowns", {}).get(dropdown_key, [])
        # Compare with all whitespace stripped so cosmetic spacing choices
        # (e.g. "A/B/C" in the schema vs "A / B / C" rendered) don't false-positive.
        normalized_frontend = re.sub(r"\s+", "", frontend_text)
        missing_labels = [
            o["label"] for o in options
            if o.get("label") and re.sub(r"\s+", "", o["label"]) not in normalized_frontend
        ]
        if missing_labels:
            findings.append(_finding(field, "hardcoded_label",
                f"every staticDropdowns.{dropdown_key} option label should render as visible text",
                f"label(s) not found in frontend: {', '.join(missing_labels)}"))
    return findings


# ── Category B: country_validation ──────────────────────────────────────────

def check_country_validation(field: dict, combined_text: str) -> list:
    """Checks BOTH frontend and backend text — the skill's own instructions call
    for wiring these into "the input's HTML attributes AND a submit-time JS
    check", not necessarily backend validation too, so a pattern that only
    exists client-side is legitimate, not a finding."""
    findings = []
    variants = field.get("countryVariants")
    if not variants:
        return findings
    key = field["key"]
    for country, variant in variants.items():
        pattern = variant.get("pattern")
        # A pattern written inside a JS string literal has its backslashes
        # doubled ('^\\d{3}' for ^\d{3}) — accept either spelling.
        if pattern and pattern not in combined_text and pattern.replace("\\", "\\\\") not in combined_text:
            findings.append(_finding(field, "country_validation",
                f"'{key}' countryVariants.{country}.pattern ({pattern}) enforced somewhere (client or server)",
                "literal pattern not found in frontend or backend file — may be shown only as a hint/placeholder"))
    return findings


# ── Category C: conditional_logic ───────────────────────────────────────────

def _extract_tokens_from_logic(logic: str) -> list:
    """Pull comparison-value string literals and snake_case-ish identifiers
    out of a compound dependsOn/visibleIf.logic expression, e.g.
    "NOT (country_from_step1 == 'US' OR ...)" -> ["US", "country_from_step1", ...]."""
    quoted = re.findall(r"'([^']*)'", logic)
    idents = re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_.]*\b", logic)
    idents = [t for t in idents if t not in ("NOT", "OR", "AND", "logic")]
    return quoted + idents


def check_conditional_logic(field: dict, frontend_text_lines: list) -> list:
    findings = []
    key = field["key"]
    cond = field.get("dependsOn") or field.get("visibleIf")
    if not cond:
        return findings

    dep_ids = html_id_variants(key)
    dep_lines = []
    for did in dep_ids:
        dep_lines.extend(find_line_numbers(frontend_text_lines, did))
    if not dep_lines:
        findings.append(_finding(field, "conditional_logic",
            f"'{key}' has a dependsOn/visibleIf rule in the schema",
            "no reference to this field's id found in the frontend at all — likely not wired up"))
        return findings

    if "logic" in cond:
        tokens = _extract_tokens_from_logic(cond["logic"])
    elif "field" in cond or "value" in cond:
        tokens = [cond.get("field", "")]
        val = cond.get("value")
        if isinstance(val, list):
            tokens.extend(str(v) for v in val)
        elif val is not None:
            tokens.append(str(val))
    else:
        # Prose-only condition (a "note" describing the rule in English, no
        # structured field/value/logic) — nothing to compare textually. This
        # is a real blind spot, not a pass: report it as unverifiable rather
        # than silently emitting no finding, so a human/LLM knows to check it.
        findings.append(_finding(field, "conditional_logic",
            f"'{key}' has a prose-only dependsOn/visibleIf (no field/value/logic to check)",
            "cannot be verified by this script — needs manual or LLM review of the schema note",
            severity="minor"))
        return findings

    missing = []
    for tok in tokens:
        if not tok:
            continue
        tok_variants = html_id_variants(tok) if re.match(r"^[a-zA-Z_]", tok) else [tok]
        # Some schema dependsOn/visibleIf conditions reference a synthetic
        # concept name rather than a literal field id — country_from_step1 is
        # "the Step 1 formation country", which every known implementation
        # tracks in a JS variable called step1Country, not a field literally
        # named country_from_step1. Accept either spelling.
        if tok in SYNTHETIC_TOKEN_ALIASES:
            tok_variants = tok_variants + SYNTHETIC_TOKEN_ALIASES[tok]
        tok_lines = []
        for tv in tok_variants:
            tok_lines.extend(find_line_numbers(frontend_text_lines, tv))
        if not any_pair_within_window(dep_lines, tok_lines, WINDOW_LINES):
            missing.append(tok)

    if missing:
        findings.append(_finding(field, "conditional_logic",
            f"'{key}' condition references {tokens}",
            f"token(s) not found near '{key}'s wiring (within {WINDOW_LINES} lines): {', '.join(missing)}"))
    return findings


def check_no_back_navigation(frontend_text: str) -> list:
    findings = []
    if re.search(r'\b(?:class|className)\s*=\s*\{?["\'`][^"\'`]*\bbtn-back\b', frontend_text) or re.search(r'>\s*[←]?\s*Back\s*<', frontend_text):
        findings.append({
            "file": "(frontend)", "field": "(navigation)", "category": "conditional_logic",
            "expected": "no Back button on steps 2-6 (EMAP does not support replaying an accepted step)",
            "actual": "a Back-labeled button or .btn-back element was found", "severity": "blocker",
        })
    return findings


# ── Category D: dropdown_route ──────────────────────────────────────────────

# Every form here is pure client-side (no backend of any kind) — each fetches
# EMAP's dropdown endpoints directly from the browser. Not every integration
# mode uses every endpoint: Integration 1 uses all 6; Integration 2 fetches
# countries/states/industry_types live; Integration 3 fetches only
# countries/industry_types (its state field is a hardcoded static <select>
# of US states, not fetched — verified against the actual template).
DROPDOWNS_BY_INTEGRATION = {
    "1": {"countries", "states", "industry_types", "shopping_carts", "referral_sources", "interest_details"},
    "2": {"countries", "states", "industry_types"},
    "3": {"countries", "industry_types"},
}


def check_dropdown_routes(schema: dict, frontend_text: str, integration: str, fallback_text: str) -> list:
    findings = []
    endpoints = schema.get("dynamicDropdownEndpoints", {})
    expected_names = DROPDOWNS_BY_INTEGRATION.get(integration, set(endpoints.keys()))
    checked_any = False
    for name, spec in endpoints.items():
        if name not in expected_names:
            continue
        checked_any = True
        url = spec.get("url", "")
        if url and url not in frontend_text and name not in frontend_text:
            findings.append({
                "file": "(frontend)", "field": f"route:{url}", "category": "dropdown_route",
                "expected": f"a direct client-side fetch of EMAP {url} (no backend proxy — this form is pure client-side)",
                "actual": "no reference to this endpoint found in the frontend file", "severity": "blocker",
            })
    if checked_any and "fallback" not in frontend_text.lower():
        findings.append({
            "file": "(frontend)", "field": "dropdown-fallback", "category": "dropdown_route",
            "expected": "an embedded fallback dataset used when a live EMAP dropdown call fails, times out, or returns empty data",
            "actual": "no fallback reference found anywhere in the frontend file", "severity": "blocker",
        })
    for name, (value_key, minimum) in FALLBACK_MIN_ROWS.items():
        if name not in expected_names:
            continue
        rows = len(FALLBACK_ROW_RE[value_key].findall(fallback_text))
        if rows < minimum:
            findings.append({
                "file": "(frontend)", "field": f"dropdown-fallback:{name}", "category": "dropdown_route",
                "expected": (f"an embedded {name} fallback with at least {minimum} `{value_key}` rows, "
                             "copied from references/dropdown-fallbacks.json"),
                "actual": f"found {rows} `{value_key}` rows in the form's files", "severity": "blocker",
            })
    return findings


# Minimum rows the embedded fallback must carry, counted as `code: "XX"` /
# `slug: "..."` entries across the form's files (a .json file in the form
# folder counts too). references/dropdown-fallbacks.json has ~248 countries
# and ~100 industry types; the thresholds leave room for trimming but fail a
# stub like [{name: 'United States', code: 'US'}]. 150 country codes can't be
# met by the ~65 US states alone.
FALLBACK_MIN_ROWS = {"countries": ("code", 150), "industry_types": ("slug", 50)}
_Q = r"""\\?["']"""
FALLBACK_ROW_RE = {
    "code": re.compile(rf"(?:{_Q})?\bcode(?:{_Q})?\s*:\s*{_Q}[A-Za-z]{{2}}{_Q}"),
    "slug": re.compile(rf"(?:{_Q})?\bslug(?:{_Q})?\s*:\s*{_Q}[^\"'\\\n]+{_Q}"),
}


# ── Category: error_handling ────────────────────────────────────────────────

# Integrations 1 and 3 POST to EMAP; Integration 2 only redirects.
POSTING_INTEGRATIONS = {"1", "3"}


def check_error_handling(frontend_text: str, integration: str) -> list:
    """EMAP answers a rate-limited request with 429 and invalid fields with
    422 (often with a non-JSON body for 429). A form that treats both as a
    generic failure hides the reason from the merchant and invites retries.
    Textual check only: the status code must be compared somewhere."""
    if integration not in POSTING_INTEGRATIONS:
        return []
    findings = []
    for code, meaning in (("429", "rate limited: ask the merchant to wait before retrying"),
                          ("422", "validation failed: show the per-field `errors`")):
        if not re.search(rf"\b{code}\b", frontend_text):
            findings.append({
                "file": "(frontend)", "field": f"http-{code}", "category": "error_handling",
                "expected": f"an explicit HTTP {code} branch ({meaning}), see references/api-errors.md",
                "actual": f"no {code} status check found in the form's files", "severity": "blocker",
            })
    return findings


# ── Finding helpers / formatting ────────────────────────────────────────────

def _finding(field: dict, category: str, expected: str, actual: str, severity: str = "blocker") -> dict:
    return {
        "file": field.get("_file", "(frontend)"),
        "field": field["key"],
        "step": field.get("step"),
        "category": category,
        "expected": expected,
        "actual": actual,
        "severity": severity,
    }


def group_findings(findings: list) -> list:
    """Collapse findings that share (category, expected, actual) into one
    line listing every affected field, per the plan's 'duplicate findings
    grouped into one line' requirement."""
    groups = {}
    order = []
    for f in findings:
        gkey = (f["category"], f["expected"], f["actual"])
        if gkey not in groups:
            groups[gkey] = {"fields": [], "severity": f.get("severity", "blocker")}
            order.append(gkey)
        groups[gkey]["fields"].append(f["field"])
    grouped = []
    for gkey in order:
        category, expected, actual = gkey
        g = groups[gkey]
        deduped_fields = list(dict.fromkeys(g["fields"]))  # preserve order, drop repeats
        grouped.append({"category": category, "fields": deduped_fields, "expected": expected,
                         "actual": actual, "severity": g["severity"]})
    return grouped


def print_findings(grouped: list) -> None:
    for g in grouped:
        fields = ", ".join(g["fields"])
        tag = "blocker" if g["severity"] == "blocker" else "advisory"
        print(f"[{g['category']}:{tag}] {fields}")
        print(f"    expected: {g['expected']}")
        print(f"    actual:   {g['actual']}")


# ── Caching (fingerprint of inputs) ─────────────────────────────────────────

def fingerprint(paths: list, extra: str = "") -> str:
    h = hashlib.sha256(extra.encode())
    for p in sorted(paths):
        try:
            h.update(p.read_bytes())
        except FileNotFoundError:
            h.update(b"<missing>")
    return h.hexdigest()


def load_cache(cache_path: Path) -> dict:
    if cache_path.exists():
        try:
            return json.loads(cache_path.read_text())
        except Exception:
            return {}
    return {}


def save_cache(cache_path: Path, fp: str, passed: bool) -> None:
    cache_path.write_text(json.dumps({"fingerprint": fp, "passed": passed}))


# ── Main ─────────────────────────────────────────────────────────────────

def discover_frontend_files(form_dir: Path) -> list:
    """Every frontend source file under form_dir, recursively, in any stack.
    Build output, dependencies and test files are skipped."""
    found = []
    for p in sorted(form_dir.rglob("*")):
        rel_parts = p.relative_to(form_dir).parts
        if any(part in SKIP_DIRS for part in rel_parts[:-1]):
            continue
        if p.is_file() and p.suffix.lower() in FRONTEND_EXTS and not SKIP_FILE_RE.search(p.name):
            found.append(p)
    return found


def discover_data_files(form_dir: Path) -> list:
    """JSON files under form_dir, read only for the fallback-dataset check
    (a port may keep the dropdown fallback snapshot in its own .json file)."""
    found = []
    for p in sorted(form_dir.rglob("*.json")):
        rel_parts = p.relative_to(form_dir).parts
        if any(part in SKIP_DIRS for part in rel_parts[:-1]):
            continue
        if p.is_file() and not p.name.startswith(("package", "tsconfig", "verify-cache")):
            found.append(p)
    return found


def decode_long_js_strings(text: str) -> tuple:
    """Return (text with long double-quoted literals replaced by "", list of
    decoded literal contents). Literals that aren't valid JSON string syntax
    are left in place untouched."""
    decoded = []

    def repl(m):
        try:
            decoded.append(json.loads(m.group(0)))
            return '""'
        except json.JSONDecodeError:
            return m.group(0)

    return LONG_JS_STRING_RE.sub(repl, text), decoded


def load_sources(paths: list) -> tuple:
    """Read every frontend file and return (widget_text, logic_lines).

    widget_text: all markup/code, used for widget, label, country-pattern
    and dropdown checks.
    logic_lines: script code only, used for conditional_logic proximity —
    markup proximity alone would false-pass two adjacent fields with no JS
    wiring between them. Files are separated by blank lines wider than
    WINDOW_LINES so references in different files never count as "near"."""
    widget_parts, logic_parts, template_texts = [], [], []
    for p in paths:
        text = p.read_text(encoding="utf-8", errors="replace")
        if p.suffix.lower() in COMPONENT_EXTS:
            stripped, decoded = decode_long_js_strings(text)
            widget_parts.append(text + "\n" + "\n".join(decoded))
            logic = [stripped] + [d for d in decoded
                                  if JS_CODE_RE.search(d) and not d.lstrip().startswith("<")]
            logic_parts.append("\n".join(logic))
        else:
            widget_parts.append(text)
            template_texts.append(text)
            scripts = extract_script_lines(text)
            if scripts:
                logic_parts.append("\n".join(scripts))
    if not logic_parts:
        # No JS found anywhere (e.g. a template whose script tags are
        # rendered by a helper) — fall back to the whole template text.
        logic_parts = template_texts
    sep = "\n" * (WINDOW_LINES + 2)
    return "\n".join(widget_parts), sep.join(logic_parts).splitlines()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    ap.add_argument("--form-dir", type=Path, default=Path("."))
    ap.add_argument("--frontend", type=Path, action="append", default=None,
                    help="frontend file to check (repeatable); default: every frontend source file under --form-dir")
    ap.add_argument("--backend", type=Path, default=None,
                    help="optional extra file whose validation code also counts for country_validation")
    ap.add_argument("--integration", choices=["1", "2", "3"], default="1")
    ap.add_argument("--category", choices=CATEGORIES)
    ap.add_argument("--step", type=int)
    ap.add_argument("--fields", type=str, help="comma-separated schema field keys to check")
    ap.add_argument("--json", action="store_true", help="print raw findings JSON instead of grouped text")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--cache-file", type=Path, default=None,
                    help=f"where to keep the pass cache (default: {CACHE_FILE_NAME} next to this script "
                         "when it is installed in .emap/, otherwise no cache)")
    args = ap.parse_args()

    schema = load_schema(args.schema)
    form_dir = args.form_dir
    frontend_paths = args.frontend or discover_frontend_files(form_dir)
    missing = [p for p in frontend_paths if not p.exists()]
    if not frontend_paths or missing:
        where = ", ".join(str(p) for p in missing) if missing else str(form_dir)
        print(f"ERROR: no frontend file found ({where}). Looked recursively for "
              f"{' '.join(sorted(FRONTEND_EXTS))} files, skipping {', '.join(sorted(SKIP_DIRS))}.",
              file=sys.stderr)
        return 2
    backend_path = args.backend

    cache_path = args.cache_file or default_cache_path()
    data_paths = discover_data_files(form_dir) if not args.frontend else []
    fp_inputs = [args.schema] + list(frontend_paths) + data_paths + ([backend_path] if backend_path else [])
    # The integration is part of the key: the same files pass or fail differently per integration.
    fp = fingerprint(fp_inputs, extra=f"integration={args.integration}")
    scoped = args.category or args.step or args.fields
    use_cache = cache_path is not None and not args.no_cache and not scoped
    if use_cache:
        cached = load_cache(cache_path)
        if cached.get("fingerprint") == fp and cached.get("passed"):
            print("PASS (cached — no changes since last verified run)")
            return 0

    frontend_text, script_lines = load_sources(frontend_paths)
    backend_text = backend_path.read_text(encoding="utf-8", errors="replace") if backend_path else ""

    fields = all_fields(schema)

    # Integration-aware scope: 2 and 3 only render Step 1 (their dropdown
    # checks are scoped by DROPDOWNS_BY_INTEGRATION) — see verify/README.md.
    if args.integration in ("2", "3"):
        fields = [f for f in fields if f["step"] == 1]

    if args.step:
        fields = [f for f in fields if f["step"] == args.step]
    if args.fields:
        wanted = set(args.fields.split(","))
        fields = [f for f in fields if f["key"] in wanted]

    findings = []
    run_widget = args.category in (None, "widget_type")
    run_country = args.category in (None, "country_validation")
    run_cond = args.category in (None, "conditional_logic")
    run_dropdown = args.category in (None, "dropdown_route") and not args.step and not args.fields
    run_errors = args.category in (None, "error_handling") and not args.step and not args.fields

    combined_text = frontend_text + "\n" + backend_text

    for field in fields:
        if run_widget:
            findings.extend(check_widget_type(field, frontend_text, schema))
        if run_country:
            findings.extend(check_country_validation(field, combined_text))
        if run_cond:
            findings.extend(check_conditional_logic(field, script_lines))

    if run_cond and not args.fields:
        findings.extend(check_no_back_navigation(frontend_text))
    if run_dropdown:
        fallback_text = frontend_text + "\n" + "\n".join(
            p.read_text(encoding="utf-8", errors="replace") for p in data_paths)
        findings.extend(check_dropdown_routes(schema, frontend_text, args.integration, fallback_text))
    if run_errors:
        findings.extend(check_error_handling(frontend_text, args.integration))

    blockers = [f for f in findings if f.get("severity", "blocker") == "blocker"]
    passed = len(blockers) == 0

    if args.json:
        print(json.dumps(findings, indent=2))
    elif not findings:
        print("PASS")
    elif passed:
        # Only advisory (non-blocking) findings — still PASS, but show them so
        # a human knows what the script couldn't verify.
        print("PASS (with advisories the script can't verify itself)")
        print_findings(group_findings(findings))
    else:
        print_findings(group_findings(findings))

    if use_cache:
        save_cache(cache_path, fp, passed)

    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
