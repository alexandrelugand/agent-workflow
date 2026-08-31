# Brainstorming

> **Phase 0 — Optional**: Explore and scope product ideas before diving into PRD and detailed planning.

## When to Use

- Starting a new product from scratch
- Exploring multiple concepts and need to choose
- Refining vague ideas into structured concepts
- User has an idea but hasn't defined scope yet

## Purpose

- Generate and evaluate product concepts
- Structure ideas for agentic pipeline execution
- Document assumptions and trade-offs
- Provide clear output for PRD phase

## Process Flow

1. **Explore** (15-30 min): Brainstorm 5-10 concepts
2. **Evaluate** (15-30 min): Score candidates on fit, feasibility, value, innovation
3. **Refine** (15-30 min): Choose best concept, structure for PRD

## Output

Create `docs/brainstorming.md` with:
- Product concept (name, tagline, vision)
- Target users
- Differentiators
- Core features (MVP: top 5)
- Success metrics
- Risk areas
- Technical constraints
- Next steps

## Pipeline Integration

```
Brainstorming → PRD → User Stories → Stories Review → Architecture + Design System
→ Research → Design → Plan → Execute → Review → Ship
```

## Best Practices

- Keep MVP-scoped (no "everything including kitchen sink")
- Document all assumptions
- Be user-centric (start with needs, not features)
- Think differentiating (why use this over alternatives?)
- Make output actionable for agentic execution

## After Brainstorming

Use `/aw-prd` to create the Product Requirements Document based on your brainstorming output.

## Templates

See `src/templates/brainstorming.md` for the structured format.