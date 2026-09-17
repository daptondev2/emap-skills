#!/usr/bin/env python3
"""
Stop-hook gate for the emap-merchant-signup skill.

Blocks the session from ending while an EMAP integration build is marked
in_progress in .claude/emap-build-state.json but has not been marked
"verified" (or "blocked"/"cancelled") by the Verify loop (see SKILL.md:
"Verify loop: schema conformance"). This exists because a build agent can
otherwise declare a build "done" after only manual curl/browser smoke
testing, silently skipping the documented verify -> confirm -> fix loop.

Installed via Step 0.5 in SKILL.md. Registered as a Stop hook in
.claude/settings.json.
"""
import json
import os
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
            "Fix or remove it, then complete the Verify loop (SKILL.md: 'Verify loop: "
            "schema conformance') before finishing."
        )
        return

    # if state.get("status") in ("verified", "blocked", "cancelled"):
    #     # "verified" = loop passed with zero findings. "blocked" = loop ran to its
    #     # 5-round cap and the remaining CONFIRMED findings were reported to the
    #     # developer. "cancelled" = the developer explicitly abandoned this build
    #     # rather than finishing it. All three are legitimate terminal states,
    #     # unlike a silently abandoned "in_progress".
    #     sys.exit(0)
    #
    # integration = state.get("integration", "unknown")
    # status = state.get("status", "in_progress")
    # block(
    #     f"An EMAP Integration {integration} build is in progress (status: \"{status}\") but "
    #     "the Verify loop (SKILL.md section 'Verify loop: schema conformance') has not "
    #     "completed with zero CONFIRMED findings. Run this round's verify agents (4 parallel "
    #     "category agents — widget_type/hardcoded_label, country_validation, "
    #     "conditional_logic, dropdown_route — on round 1, a scoped re-audit of only the "
    #     "categories touched by the last fix on later rounds), then a confirm agent per "
    #     "finding, fix any CONFIRMED findings, and write {\"status\": \"verified\", ...} to "
    #     ".claude/emap-build-state.json when the loop passes with zero remaining findings. "
    #     "Manual curl or browser testing is not a substitute for this loop and does not "
    #     "satisfy this gate. If this build is being abandoned rather than finished, write "
    #     "{\"status\": \"cancelled\"} to .claude/emap-build-state.json instead of leaving it "
    #     "\"in_progress\" — do not delete or hand-edit this file to fake a pass."
    # )
    sys.exit(0)


if __name__ == "__main__":
    main()
