#!/usr/bin/env python3
"""
Stop-hook gate for the emap-merchant-signup skill's script-based verify step.

This hook does not trust a self-reported "status": "verified" field — it
actually RUNS verify_form.py itself against the tracked build and only
allows the session to end if that run passes.

Blocks the session from ending while an EMAP integration build is tracked in
.claude/emap-build-state.json and verify_form.py does not currently pass for
it — regardless of what "status" the state file claims. "blocked" (5-round
cap reached, findings reported to the developer) and "cancelled" (abandoned)
are accepted as legitimate terminal states and are not re-checked.

Installed via Step 1 in SKILL.md. Registered as a Stop hook in
.claude/settings.json.
"""
import json
import os
import subprocess
import sys


def block(reason: str) -> None:
    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(2)


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        # Can't read the event payload — fail open rather than wedge the session.
        sys.exit(0)

    # Avoid looping forever if we already blocked once for this stop attempt.
    if data.get("stop_hook_active"):
        sys.exit(0)

    cwd = data.get("cwd") or os.getcwd()
    hooks_dir = os.path.join(cwd, ".claude", "hooks")
    state_path = os.path.join(cwd, ".claude", "emap-build-state.json")

    if not os.path.isfile(state_path):
        # No EMAP build tracked in this project — nothing to gate.
        sys.exit(0)

    try:
        with open(state_path, encoding="utf-8") as f:
            state = json.load(f)
    except Exception:
        block(
            ".claude/emap-build-state.json exists but could not be parsed as JSON. "
            "Fix or remove it, then get verify_form.py passing (see verify/SKILL.md) before finishing."
        )
        return

    status = state.get("status", "in_progress")
    if status in ("cancelled", "blocked"):
        # cancelled = developer explicitly abandoned the build.
        # blocked = the fix loop hit its round cap and reported remaining
        # findings to the developer already — both are legitimate stops.
        sys.exit(0)

    integration = state.get("integration", "1")
    form_dir = state.get("form_dir")
    if not form_dir:
        block(
            ".claude/emap-build-state.json is missing \"form_dir\" (the directory holding the "
            "generated form files). Add it, e.g. {\"form_dir\": \"merchant-signup\"}, so the verify "
            "gate knows what to check."
        )
        return

    script_path = os.path.join(hooks_dir, "verify_form.py")
    schema_path = os.path.join(hooks_dir, "signup-steps-schema.json")
    if not os.path.isfile(script_path):
        block(
            f"{script_path} is missing — Step 1 should have copied verify_form.py into "
            ".claude/hooks/ alongside this hook. Re-run Step 1's file copy, then try again."
        )
        return

    form_dir_abs = os.path.join(cwd, form_dir) if not os.path.isabs(form_dir) else form_dir
    cmd = [
        sys.executable, script_path,
        "--schema", schema_path,
        "--form-dir", form_dir_abs,
        "--integration", str(integration),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except Exception as e:
        block(f"Could not run verify_form.py ({e}). Fix the verify setup before finishing.")
        return

    if result.returncode == 0:
        # Genuinely passing right now — allow the stop, and correct the state
        # file if it hadn't been updated yet (we don't trust it, but we do
        # keep it accurate for anyone reading it afterward).
        if status != "verified":
            try:
                state["status"] = "verified"
                with open(state_path, "w", encoding="utf-8") as f:
                    json.dump(state, f, indent=2)
            except Exception:
                pass  # non-fatal — the gate's own re-check is what matters, not this file
        sys.exit(0)

    output = (result.stdout or "") + (result.stderr or "")
    block(
        "verify_form.py does not currently pass for this build (this is checked directly by the "
        "hook, not by trusting emap-build-state.json's \"status\" field). Findings:\n\n"
        f"{output.strip()}\n\n"
        "Fix these, then attempt to finish again — the hook will re-run the script. After 5 "
        "verify/fix rounds with findings still remaining, write \"status\": \"blocked\" to "
        ".claude/emap-build-state.json (with the remaining findings) and report them to the "
        "developer instead of continuing to loop — see verify/SKILL.md."
    )


if __name__ == "__main__":
    main()
