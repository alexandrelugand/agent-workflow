---
description: Frame the project — target, development approach, scope, the WHAT and the WHY
argument-hint: <target or project idea>
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---
You are framing a agent-workflow project. Subject: $ARGUMENTS

Use this template as the output structure:
@templates/prd.md

agent-workflow builds projects by developing a product — the target is the spec. Before anything else, lock the project frame.

Proceed as follows:
1. The project preamble — ask me, one question at a time:
   - Target: which project are we developing? (name, URL). If $ARGUMENTS names it, confirm it.
   - Development approach: greenfield (start from scratch) | extend existing | integrate components | replace current solution? The whole scope depends on this answer.
   - Why: what problem are we solving, what's the gap, what doesn't exist yet?
   - Scope: we never develop everything at once. Which features deliver the core value for OUR case? And what stays explicitly out (the excluded: enterprise features, edge-case admin, integrations nobody uses)?
   - Complexity: score each feature 1-5 (scale in the template). A 4-5 must earn its place — the default home of heavy features is the excluded.
   - Differentiators: what do we do differently or better than existing solutions?
2. Then the classic frame: need, target users, constraints, success criteria. Success = achieving the scope + the differentiators, measurable.
3. Fill each section of the template with my answers. Fill nothing you haven't validated with me.
4. Write the result to `docs/prd.md` and commit it on the default branch (docs: prd).

End with: "PRD ready in docs/prd.md. Next step: /aw-stories"
