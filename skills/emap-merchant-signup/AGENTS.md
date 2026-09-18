# EMAP merchant signup skill

Instructions for any AI coding agent. [`SKILL.md`](SKILL.md) is the full spec: follow it from the
top. Agents that support skills load it automatically from this folder. For any other agent, point
it at `SKILL.md`, or copy this file into the project's own `AGENTS.md` or rules file.

It builds a partner's merchant-signup form in any tech stack: Integration 1 (full 6-step form on
the partner site), Integration 2 (redirect handoff), or Integration 3 (email-based signup).

The rules that matter most (`SKILL.md` is authoritative if anything here disagrees):

1. **Ask the two required questions first**: which integration, and whether they have a partner
   key. Use your multiple-choice question tool if you have one, otherwise a numbered list in plain
   text. Wait for the answers before reading references or writing code.
2. **Install the verify gate before writing form code** (SKILL.md Step 1). It needs Python 3 and
   lives in the target project's `.emap/` folder.
3. **Every EMAP call is made from the merchant's browser, never from a server.** EMAP rate-limits
   by the caller's IP. See [`references/stack-guide.md`](references/stack-guide.md).
4. **Build from [`signup-steps-schema.json`](signup-steps-schema.json) and the templates**, never
   from prose or field names.
5. **Done means `python3 .emap/emap_gate.py` prints `PASS`.** After 5 failing gate runs the build
   is marked blocked: report the findings to the developer instead of claiming it works.
