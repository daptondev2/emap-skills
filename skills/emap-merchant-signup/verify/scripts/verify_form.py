#!/usr/bin/env python3
"""
verify_form.py — deterministic schema-conformance checker for a generated
EMAP merchant-signup form. No LLM involved: reads signup-steps-schema.json
and the generated form/backend files directly, and reports mismatches.

Checks 4 categories:
  widget_type    — rendered widget matches the schema's `type`, and any
                    hardcoded (staticDropdowns) field renders the option
                    `label`, not the raw `value`/`slug`.
  country_validation — every countryVariants `pattern` is present verbatim
                    somewhere in the backend validation code, not just shown
                    as a hint/placeholder.
  conditional_logic — every dependsOn/visibleIf field has its controlling
                    field id and comparison value referenced near its own
                    show/hide/require code, and no Back-navigation exists.
  dropdown_route — every dynamicDropdownEndpoints entry has a matching proxy
                    route in the backend, with a fallback reference.

Usage:
  verify_form.py [--schema PATH] [--form-dir DIR] [--frontend FILE]
                  [--backend FILE] [--integration {1,2,3}]
                  [--category {widget_type,country_validation,conditional_logic,dropdown_route}]
                  [--step N] [--fields a,b,c] [--json] [--no-cache]

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
CACHE_FILE_NAME = ".emap_verify_cache.json"


def default_schema_path() -> Path:
    """This script lives in two layouts: inside the skill repo at
    verify/scripts/verify_form.py (schema two levels up), or copied next to
    the schema itself into a target project's .claude/hooks/ (schema in the
    same directory, per Step 1). Try both, same-directory first since
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
    return list(variants)


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

def check_widget_type(field: dict, frontend_text: str, schema: dict) -> list:
    findings = []
    key = field["key"]
    ftype = field.get("type")
    if ftype in ("hidden",):
        return findings  # hidden fields aren't user-facing widgets, nothing to render-check

    ids = html_id_variants(key)
    id_pattern = "|".join(re.escape(i) for i in ids)

    def present(pattern: str) -> bool:
        return re.search(pattern, frontend_text) is not None

    if ftype in SELECT_TYPES:
        if not present(rf'<select[^>]*(?:id|name)="(?:{id_pattern})"'):
            findings.append(_finding(field, "widget_type",
                f"expected a <select> for '{key}'", "no matching <select> found"))
    elif ftype in CHECKBOX_GROUP_TYPES:
        if not re.search(rf'type="checkbox"[^>]*name="{re.escape(key)}\[\]"', frontend_text) \
           and not re.search(rf'name="{re.escape(key)}\[\]"[^>]*type="checkbox"', frontend_text):
            findings.append(_finding(field, "widget_type",
                f"expected a checkbox-group for '{key}' (multiple type=\"checkbox\" inputs named '{key}[]')",
                "no matching checkbox-group found"))
        if present(rf'<select[^>]*(?:id|name)="(?:{id_pattern})"'):
            findings.append(_finding(field, "widget_type",
                f"'{key}' is a checkbox-group in the schema", "rendered as a <select> instead"))
    elif ftype in RADIO_TYPES:
        if not re.search(rf'type="radio"[^>]*name="{re.escape(key)}"', frontend_text) \
           and not re.search(rf'name="{re.escape(key)}"[^>]*type="radio"', frontend_text):
            findings.append(_finding(field, "widget_type",
                f"expected radio buttons for '{key}'", "no matching type=\"radio\" inputs found"))
        if present(rf'<select[^>]*(?:id|name)="(?:{id_pattern})"'):
            findings.append(_finding(field, "widget_type",
                f"'{key}' is radio (Yes/No) in the schema", "rendered as a <select> instead"))
    elif ftype in CHECKBOX_TYPES:
        if not re.search(rf'type="checkbox"[^>]*(?:id|name)="(?:{id_pattern})"', frontend_text) \
           and not re.search(rf'(?:id|name)="(?:{id_pattern})"[^>]*type="checkbox"', frontend_text):
            findings.append(_finding(field, "widget_type",
                f"expected a single checkbox for '{key}'", "no matching type=\"checkbox\" input found"))
    elif ftype in TEXTAREA_TYPES:
        if not present(rf'<textarea[^>]*(?:id|name)="(?:{id_pattern})"'):
            findings.append(_finding(field, "widget_type",
                f"expected a <textarea> for '{key}'", "no matching <textarea> found"))
    else:
        # text / tel / email / number / date / url and anything else -> plain <input>
        if not present(rf'<input[^>]*(?:id|name)="(?:{id_pattern})"'):
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
        if pattern and pattern not in combined_text:
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
    if re.search(r'class="[^"]*\bbtn-back\b[^"]*"', frontend_text) or re.search(r'>\s*[←]?\s*Back\s*<', frontend_text):
        findings.append({
            "file": "(frontend)", "field": "(navigation)", "category": "conditional_logic",
            "expected": "no Back button on steps 2-6 (EMAP does not support replaying an accepted step)",
            "actual": "a Back-labeled button or .btn-back element was found", "severity": "blocker",
        })
    return findings


# ── Category D: dropdown_route ──────────────────────────────────────────────

def check_dropdown_routes(schema: dict, backend_text: str) -> list:
    findings = []
    endpoints = schema.get("dynamicDropdownEndpoints", {})
    for name, spec in endpoints.items():
        url = spec.get("url", "")
        if url and url not in backend_text and name not in backend_text:
            findings.append({
                "file": "(backend)", "field": f"route:{url}", "category": "dropdown_route",
                "expected": f"a proxy route forwarding to EMAP {url}",
                "actual": "no reference to this endpoint found in the backend file", "severity": "blocker",
            })
        if "dropdown-fallback" not in backend_text.lower() and "fallback" not in backend_text.lower():
            findings.append({
                "file": "(backend)", "field": f"route:{url}", "category": "dropdown_route",
                "expected": "a fallback to references/dropdown-fallbacks.json when the live call fails",
                "actual": "no fallback reference found anywhere in the backend file", "severity": "blocker",
            })
            break  # one missing-fallback finding for the whole file is enough, don't repeat per-endpoint
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

def fingerprint(paths: list) -> str:
    h = hashlib.sha256()
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

def detect_frontend(form_dir: Path) -> Path | None:
    for candidate in ("plain-html.html", "index.php", "index.html"):
        p = form_dir / candidate
        if p.exists():
            return p
    html_files = list(form_dir.glob("*.html"))
    return html_files[0] if html_files else None


def detect_backend(form_dir: Path, frontend: Path | None) -> Path | None:
    candidates = []
    for ext in ("*.php", "*.js", "*.ts"):
        candidates.extend(form_dir.glob(ext))
    candidates = [c for c in candidates if c != frontend]
    return candidates[0] if candidates else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    ap.add_argument("--form-dir", type=Path, default=Path("."))
    ap.add_argument("--frontend", type=Path, default=None)
    ap.add_argument("--backend", type=Path, default=None)
    ap.add_argument("--integration", choices=["1", "2", "3"], default="1")
    ap.add_argument("--category", choices=["widget_type", "country_validation", "conditional_logic", "dropdown_route"])
    ap.add_argument("--step", type=int)
    ap.add_argument("--fields", type=str, help="comma-separated schema field keys to check")
    ap.add_argument("--json", action="store_true", help="print raw findings JSON instead of grouped text")
    ap.add_argument("--no-cache", action="store_true")
    args = ap.parse_args()

    schema = load_schema(args.schema)
    form_dir = args.form_dir
    frontend_path = args.frontend or detect_frontend(form_dir)
    if not frontend_path or not frontend_path.exists():
        print(f"ERROR: no frontend file found in {form_dir} (looked for plain-html.html / index.php / index.html / *.html)", file=sys.stderr)
        return 2
    backend_path = args.backend or detect_backend(form_dir, frontend_path)

    cache_path = form_dir / CACHE_FILE_NAME
    fp_inputs = [args.schema, frontend_path] + ([backend_path] if backend_path else [])
    fp = fingerprint(fp_inputs)
    scoped = args.category or args.step or args.fields
    if not args.no_cache and not scoped:
        cached = load_cache(cache_path)
        if cached.get("fingerprint") == fp and cached.get("passed"):
            print("PASS (cached — no changes since last verified run)")
            return 0

    frontend_text = frontend_path.read_text(encoding="utf-8", errors="replace")
    backend_text = backend_path.read_text(encoding="utf-8", errors="replace") if backend_path else ""
    # conditional_logic must check actual JS wiring, not markup proximity —
    # if the backend is JS/TS (no separate frontend script), fall back to
    # scanning the frontend file whole (it's likely already JS-only in that case).
    script_lines = extract_script_lines(frontend_text) or frontend_text.splitlines()

    fields = all_fields(schema)

    # Integration-aware scope: 2 and 3 only render Step 1, and have no
    # dropdown-proxy backend in the Integration-1 sense (2 has none at all;
    # 3's single endpoint isn't a dropdown proxy) — see verify/SKILL.md.
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
    if run_dropdown and args.integration == "1" and backend_text:
        findings.extend(check_dropdown_routes(schema, backend_text))

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

    if not args.no_cache and not scoped:
        save_cache(cache_path, fp, passed)

    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
