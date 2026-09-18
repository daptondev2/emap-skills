#!/usr/bin/env python3
"""
emap_gate.py — the "definition of done" gate for an EMAP merchant-signup build.

Works with any AI agent, in CI, or run by hand. It reads the build state from
.emap/build-state.json, runs verify_form.py itself against the tracked form
(it never trusts a self-reported "status"), and records the result:

  { "status": "in_progress" | "verified" | "blocked" | "cancelled",
    "integration": "1" | "2" | "3",
    "form_dir": "merchant-signup",      # relative to the project root
    "rounds": 0 }                       # failing gate runs so far (written by this script)

Installed layout in the target project (SKILL.md Step 1):

  .emap/emap_gate.py
  .emap/verify_form.py
  .emap/signup-steps-schema.json
  .emap/build-state.json

Usage:
  python3 .emap/emap_gate.py                     # any agent, CI, or the developer
  python3 .emap/emap_gate.py --claude-stop-hook  # Claude Code Stop hook adapter

CLI exit codes: 0 = verified, or nothing to check (no tracked build, or
"cancelled"); 1 = verify_form.py has findings; 2 = setup error.

Round cap: each failing run increments "rounds". On the 5th failing run the
status becomes "blocked": stop fixing and report the findings to the
developer. To resume work on a blocked build, set "status" back to
"in_progress" and "rounds" to 0.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
MAX_ROUNDS = 5
STATE_NAME = "build-state.json"
CACHE_NAME = "verify-cache.json"


def default_root() -> Path:
    # Installed copies live in <project>/.emap/; otherwise use the working directory.
    return SCRIPT_DIR.parent if SCRIPT_DIR.name == ".emap" else Path.cwd()


def load_state(state_path: Path) -> dict | None:
    if not state_path.is_file():
        return None
    return json.loads(state_path.read_text(encoding="utf-8"))


def save_state(state_path: Path, state: dict) -> bool:
    try:
        state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
        return True
    except OSError:
        return False


def run_verify(root: Path, emap_dir: Path, state: dict) -> tuple[int, str]:
    script = emap_dir / "verify_form.py"
    schema = emap_dir / "signup-steps-schema.json"
    for required in (script, schema):
        if not required.is_file():
            return 2, (f"{required} is missing. SKILL.md Step 1 copies verify_form.py and "
                       "signup-steps-schema.json into .emap/ next to this script.")
    form_dir = Path(state["form_dir"])
    if not form_dir.is_absolute():
        form_dir = root / form_dir
    cmd = [sys.executable, str(script),
           "--schema", str(schema),
           "--form-dir", str(form_dir),
           "--integration", str(state.get("integration", "1")),
           "--cache-file", str(emap_dir / CACHE_NAME)]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except Exception as e:  # noqa: BLE001 — report any launch failure as a setup error
        return 2, f"Could not run verify_form.py ({e})."
    return result.returncode, ((result.stdout or "") + (result.stderr or "")).strip()


def gate(root: Path) -> tuple[str, int, str]:
    """Returns (outcome, exit_code, message). outcome is one of:
    "idle" (nothing to check), "pass", "fail", "fail-uncounted" (the state
    file couldn't be written), "capped" (this run hit the round cap),
    "blocked" (already blocked earlier), "error"."""
    emap_dir = root / ".emap"
    state_path = emap_dir / STATE_NAME
    try:
        state = load_state(state_path)
    except Exception:  # noqa: BLE001
        return "error", 2, f"{state_path} is not valid JSON. Fix or rewrite it (see verify/README.md)."
    if state is None:
        return "idle", 0, f"No EMAP build tracked ({state_path} not found). Nothing to check."

    status = state.get("status", "in_progress")
    if status == "cancelled":
        return "idle", 0, "EMAP build is marked cancelled. Nothing to check."
    if not state.get("form_dir"):
        return "error", 2, (f'{state_path} has no "form_dir" (the folder holding the form files, '
                            'relative to the project root), e.g. {"form_dir": "merchant-signup"}.')

    code, output = run_verify(root, emap_dir, state)
    if code == 2:
        return "error", 2, output

    if code == 0:
        state.update(status="verified", rounds=0)
        state.pop("last_findings", None)
        save_state(state_path, state)
        return "pass", 0, f"{output}\n\nEMAP gate: PASS. The build is verified."

    if status == "blocked":
        return "blocked", 1, (f"{output}\n\nEMAP gate: FAIL. The build is marked blocked: report "
                              "these findings to the developer. To resume fixing, set \"status\" "
                              "to \"in_progress\" and \"rounds\" to 0 in .emap/build-state.json.")

    rounds = int(state.get("rounds", 0)) + 1
    state.update(status="blocked" if rounds >= MAX_ROUNDS else "in_progress",
                 rounds=rounds, last_findings=output)
    saved = save_state(state_path, state)
    if rounds >= MAX_ROUNDS:
        return "capped", 1, (f"{output}\n\nEMAP gate: FAIL (round {rounds} of {MAX_ROUNDS}). Round "
                             "cap reached, so the build is now marked blocked. Stop fixing and "
                             "report exactly these findings to the developer instead of calling "
                             "the build done.")
    note = "" if saved else f" (could not write {state_path}, so this round was not counted)"
    return ("fail" if saved else "fail-uncounted"), 1, (f"{output}\n\nEMAP gate: FAIL (round {rounds} of {MAX_ROUNDS}){note}. Fix "
                       "exactly the findings above, then run the gate again.")


def claude_stop_hook(root: Path) -> None:
    """Claude Code Stop hook: blocking uses {"decision": "block"} JSON on
    stdout with exit code 0 (Claude Code ignores stdout JSON on exit code 2)."""
    try:
        payload = json.load(sys.stdin)
    except Exception:  # noqa: BLE001
        payload = {}
    outcome, _, message = gate(root)
    if outcome in ("idle", "pass", "blocked"):
        sys.exit(0)
    if outcome == "fail-uncounted" and payload.get("stop_hook_active"):
        # The round counter can't advance, so the cap can't end the loop: let the stop through.
        sys.exit(0)
    reason = message
    if outcome == "capped":
        reason += " Then finish; the gate will not block again for this build."
    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", type=Path, default=None,
                    help="project root holding .emap/ (default: the folder above this script's .emap/, else cwd)")
    ap.add_argument("--claude-stop-hook", action="store_true",
                    help="run as a Claude Code Stop hook (reads the hook payload on stdin)")
    args = ap.parse_args()
    root = (args.root or default_root()).resolve()
    if args.claude_stop_hook:
        claude_stop_hook(root)
    _, code, message = gate(root)
    print(message)
    return code


if __name__ == "__main__":
    sys.exit(main())
