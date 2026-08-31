---
description: Initial project brainstorming - explore and scope ideas for a new product or feature
---

# Brainstorming — <product name>

> Generate and evaluate ideas for a new product or feature, scoped and structured for the agentic pipeline. Output a structured brief that feeds directly into the PRD.

## Input

- **Target domain** or problem space: What are you trying to solve?
- **Desired outcome** (what success looks like)
- **Scope boundaries** (what's in, what's explicitly out)
- **Constraints** (technical, business, timeline, resources)

## Process

1. **Explore possibilities** (15-30 min)
   - List 5-10 potential product concepts or feature directions
   - For each: describe core value, target users, differentiation from existing solutions

2. **Evaluate and filter** (15-30 min)
   - Score each idea on: market fit, feasibility, strategic value, innovation
   - Select 1-3 strongest candidates for deeper analysis
   - Document trade-offs and assumptions

3. **Refine and structure** (15-30 min)
   - Choose the best concept (or synthesize the best elements)
   - Define product vision and strategic positioning
   - Identify 3-5 key goals and success metrics
   - Outline the minimum viable product scope

4. **Output structure**
   - Product concept name
   - Value proposition
   - Target users/segments
   - Key differentiators
   - Core features (top 5)
   - Success metrics
   - Risk areas
   - Technical constraints
   - Next steps for PRD

## Output

Create `docs/brainstorming.md` with the refined concept. Format:

```markdown
# Brainstorming — <product name>

> Initial exploration and concept selection for the agent-workflow pipeline.

## Product Concept

- **Name**: <concise title>
- **Tagline**: <one-line value proposition>
- **Vision**: <what we're building and why it matters>

## Target Users

<user segments, personas, or use cases>

## Differentiators

<what makes this unique from existing solutions>

## Core Features (MVP)

1. <feature>
2. <feature>
...

## Success Metrics

- <metric 1>
- <metric 2>
...

## Risk Areas

- <risk>
- <risk>
...

## Technical Constraints

- <constraint>
- <constraint>
...

## Next Steps

<what to do after this: proceed to PRD, do more research, etc.>
```

## Notes

- This phase is optional for established projects with clear direction
- Output feeds directly into PRD creation (aw-prd)
- Keep output scoped for agentic execution — no unbounded ideation
- Document all assumptions explicitly