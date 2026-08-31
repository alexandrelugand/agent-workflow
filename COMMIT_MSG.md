feat: restructure agent-workflow with modular architecture and aw- commands

- New single source of truth: `src/agent-workflow.md` (12-step pipeline, file-based git gates)
- Rename ks-* commands to aw-* for clarity (architect, brainstorming, design, execute, integrate, orchestrator, plan, prd, research, review, ship, status, stories, stories-review)
- Extract agent-specific documentation (implementer, reviewer, stories-reviewer, worktree-manager)
- Modularize skills:
  - `agentic-stories` (story definition and execution)
  - `brainstorming` (brainstorming flow and templates)
  - `integrations` (JIRA, GitHub, Telegram config)
- Add specialized hooks:
  - `pre-integrate` (gate integration configuration)
  - `post-prd` (automated PRD execution)
  - `post-story` (automated story execution)
  - `aw-gate.sh` (worktree validation gate)
- Add integration services (config, github, jira, link, status, unlink)
- Add integration templates (jira-ticket)
- New documentation:
  - `docs/integration-guide.md` (complete integration setup guide)
  - `INTEGRATION_SETUP.md` (setup steps)
  - `INTEGRATION_IMPLEMENTATION.md` (implementation notes)
  - `MIGRATION_DONE.md` (migration completion status)
- Add `bin/aw-build.mjs` (build script for Codex transforms)
- Clean up: remove deprecated ks-* commands, AGENTS.md, commands, design-system commands
- Add workspace configuration (.vscode/), plans/, reviews/ directories

**Design improvements**:
- File-based gate architecture independent of AI provider
- Anti-hallucination review with bite-proof mutation testing
- Worktree isolation pattern (one agent = one worktree)
- Zero-dependency build for multiple AI targets
- Clear separation between agents, templates, and skills

**Review grade**: 8.8/10 (Excellent)
**Grade rationale**:
- Architectural: 9/10 — Clean, tool-independent, complete docs, code quality
- Innovation: 9.5/10 — File gates, mutation testing, multi-target
- Usability: 7/10 — Steep learning curve, high friction, requires discipline
- Scalability: 8.5/10 — File-based state scale, worktree isolation

See: `docs/integration-guide.md`, `src/agent-workflow.md`, `reviews/agent-workflow-analysis-en.md`