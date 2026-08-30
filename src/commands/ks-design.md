---
description: Derive a story's screen from the design system. Autonomous path (the agent produces it) or brief path (an external tool produces it and the result comes back). Never freestyles outside the system.
argument-hint: <story id or name> [--agent | --brief [tool name]]
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - AskUserQuestion
  - Bash
---
# ks-design — Story design, anchored to the design system

Target story: $ARGUMENTS

Resolve the story id, then locate its dedicated `.worktrees/<id>` worktree.
Before any read or write, verify that it is on exactly `feature/<id>` and use
that absolute path for the whole command. Missing worktree, wrong branch,
detached HEAD or the repository base directory itself → STOP and run
`/ks-research <id>` to bootstrap the feature workspace. Never switch branches.

## Execution contract (non-negotiable)
You are FORBIDDEN from:
- Producing a design without an existing design system (Step 1).
- Inventing a component, token, color or spacing outside the design system.
- Designing a screen the story doesn't ask for.
- Handing over a mockup you have not rendered and looked at (Step 5).

## Workflow

### Step 1 — Prerequisites (fail-closed)
`docs/design-system.md` must exist and be non-empty.
- Missing or empty → STOP: "No design system found in docs/design-system.md. Set it up first via /ks-design-system, then rerun /ks-design." Produce NO design.
- Present → load it. Its tokens and components are the only visual source, whichever path is taken. Read the real values from the code as well (the stylesheet that defines the tokens): the document describes intent, the stylesheet holds the numbers, and the numbers win.

### Step 2 — Resolve the path (never block autonomy)
Two paths, and the mode is **resolved**, not asked, whenever it can be:
- `--agent`, or the story is running autonomously → **autonomous path**.
- `--brief [tool name]` → **brief path**, for the named tool.
- Neither, and a human is in the loop → ask once (AskUserQuestion): who produces this design, the agent or an external tool?
- Neither, and nobody can answer this turn → **autonomous path**, and say so at handover.

The external tool is deliberately unnamed in this command. Any tool that holds the design system qualifies. The same is true on the autonomous path: the agent may generate directly or through an internal design skill. Neither the tool nor the skill is prescribed here — only the deliverable and the verification are.

### Step 3 — Read the inputs
Read `docs/stories.md` and isolate the target story's acceptance criteria.

Then read `docs/research/<id>.md`. **Research is the substance of this step, not a footnote.** It already established the real fields, the existing components, the anchor points and the traps. The screen's fields, actions and states are derived from it — not invented here. If research is missing, say so: the design will rest on assumptions rather than on the code.

If the PRD names a target SaaS, its equivalent screen is a layout and UX reference — structure and states only, never visual identity. The design covers this story's screen only.

### Step 4 — Produce
**Fidelity: finished.** The design system exists, so there is no visual direction left to explore — there is a screen to derive. That means real tokens, real typography, real spacing, real copy, and every state the screen has: empty, loading, error, refused-without-leaking, plus any domain state (archived, paused, read-only). Light and dark. Desktop and mobile. Never lorem ipsum, never an invented identity.

Low fidelity is for the rare case where a screen's structure is genuinely open and two or three directions must be compared before committing. Say so explicitly when you use it.

**AUTONOMOUS path** — the agent produces:
- `docs/designs/<id>/design.md` (structure: @templates/design-screen.md)
- `docs/designs/<id>/mockup.html` — the screen, using exclusively the design system's tokens and components. Extra frames live beside it under the same folder.

**BRIEF path** — the agent writes the brief, the external tool produces the screens:
1. `docs/designs/<id>/brief.md` (structure: @templates/design-brief.md): every screen with its layout, exact fields and actions, every state, and the design-system constraints **copied in** so the brief is self-contained and pasteable. Out-of-scope stated. **This file is the deliverable of this step — not a chat message.** A file survives the session and can be picked up by a different agent or a different tool.
2. The result comes back (exported HTML, screenshot or description). Record it as `docs/designs/<id>/mockup.html` and write `docs/designs/<id>/design.md` describing the screen and pointing at it.
3. Nothing came back → end with: "Brief ready in docs/designs/<id>/brief.md — take it to your design tool, then rerun /ks-design <id> with the result." Do not generate in its place unless explicitly switched to the autonomous path.

### Step 5 — Render it and look at it (both paths, no exception)
A mockup that has never been displayed has not been verified — reading the markup is not looking at the screen. This step **sends you back**: what it finds gets fixed before handover, it is not a checkbox at the end.

It applies to a mockup brought back from an external tool exactly as it applies to a generated one — nothing guarantees an external tool honoured the real tokens.

Four checks:
- **Open it in a browser.** Serve it over local HTTP; a `file://` URL may be refused by the browser tooling.
- **Both themes.** Most rendering regressions are visible in only one of the two.
- **Both widths**, desktop and mobile, with no horizontal overflow.
- **Contrast measured**, not judged by eye, on every text/surface pair.

Then report what was checked **and what could not be checked**. No browser available is an acceptable outcome; skipping the step in silence is not — an explicit "not verified" is actionable, an omission is not.

Beware of a browser configured to force dark mode: it repaints light frames dark whatever the page does, and costs an hour chasing a bug that isn't there.

### Step 6 — Gaps
Any need the design system doesn't cover → record it under "Design system gaps" in `design.md`. **Never invent it.** A gap reported is a decision handed to the right person; a gap filled freestyle is drift that the next story inherits.

Timebox: defined enough to unblock the Plan. Finished is not the same as pixel-perfect — cover the states, don't polish forever.

## Where the design lives (hard rule)
Everything lands in the repository, under `docs/designs/<id>/`, and travels with `feature/<id>`.

**The repository is authoritative.** An external tool — including one an agent can write to — is a working surface, never the source of truth. Anything reworked there must be brought back into the repository **before** implementation, or the code and the design diverge without anyone noticing.

## Mockup status (hard rule)
`mockup.html` is a **reference, not code to copy**. In Execute the screen is built with the boilerplate's real components. The mockup communicates intent — layout, states, hierarchy; it never replaces the component system and never gets pasted into production.

End with: "Design ready (docs/designs/<id>/design.md + mockup.html), rendered and checked. Next step: /ks-plan <id>"
