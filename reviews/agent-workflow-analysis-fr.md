---
title: Agent-Workflow Comprehensive Analysis
review_date: 2026-08-31
reviewer: Claude Code
scope: Complete codebase review
---

# Review Agent-Workflow — Résumé

**Architecture globale**: Pipeline à 12 étapes, gates en fichiers git indépendants de l'AI CLI. Single source of truth: `src/agent-workflow.md`. Claude et Codex partagent mêmes règles via import.

### Composants principaux

1. **Pipeline**: Framing (6 étapes) → Per-story cycle (6 étapes)
2. **Sous-agents**: implementer (opus), reviewer (read-only, mutation testing), stories-reviewer, worktree-manager
3. **Gates**: `pre-commit` (plan validé), `pre-push` (review validé) — enforcement repo-level
4. **Intégrations**: JIRA, GitHub, Telegram — services Node.js zero-dependency
5. **Build**: `bin/aw-build.mjs` → transforme pour Codex sans npm packages

### Forces (10)

1. **Tool independence** — gates fichiers git, pas permissions AI
2. **Anti-hallucination rigueur** — reviewer mutates tests (bite proof), fresh context read-only
3. **Fail-closed** — chaque gate bloque par défaut, opt-out explicite
4. **Clean architecture** — single source, séparation claire agents/templates
5. **Multi-target** — Claude native, Codex built, Gemini prévu
6. **Docs complets** — inline + guides séparés, cheat sheet français
7. **Testing quality** — ~25 tests/story, mutation testing, "4 cuts" technique
8. **Intégration écosystème** — JIRA/GitHub/Telegram configurables
9. **Defensive design** — worktree isolation, quick fix mode exception
10. **Progress tracking** — `aw-status` dérive état depuis fichiers, pas DB

### Faiblesses (10)

1. **Steep learning curve** — 12 étapes, multiple gates, discipline requise
2. **Git worktree complexité** — conflits possibles, coordination humaine
3. **Overhead implementation** — 6 commands + subagent par story
4. **Tool limitations** — Codex permissions plus grossières, Gemini prose-only
5. **State management** — état dérivé des fichiers, risque stale si docs non commités
6. **Test budget constraints** — ~25 tests/story, ratio difficile pour quelques équipes
7. **Deployment strategy** — merge manuel par défaut, pas CI/CD décrit
8. **Error recovery** — fix mode loops 2x max, retry absent pour transient failures
9. **Human dependency** — validation plan/ship humaine, pas automatisée
10. **Docs maintenance** — templates must stay alignées avec règles

### Code quality

- Clean Node.js modules, JSDoc, error handling, try-catch/retry
- Type checking informé (JSDoc), séparation des responsabilités
- API tokens en env vars (pas hardcoded), Base64 pour JIRA Auth
- Hooks git prévent unauthorized commits

### Scalabilité

- **Good**: Worktree isolation, file-based gates scale, agents par story indépendants
- **Bottlenecks**: Plan validation, ship confirmation, git hook overhead
- **Recommandation**: CI pipeline pour automatiser gates

### Innovation (7 points uniques)

1. **File-based gate architecture** — enforcement indépendant de l'AI provider
2. **Bite proof mutation testing** — reviewer mutates pour prouver que tests "mordent"
3. **Anti-hallucination review** — subagent read-only, fresh context, skill-loaded
4. **Worktree isolation pattern** — un agent = un worktree, prévient conflits
5. **Agentic-ready story definition** — stories = shippable slices verifiable
6. **Zero-dependency build** — `aw-build.mjs` transforme sans npm
7. **Multi-target emission** — une source, multiples cibles, pas fork

### Comparaison

| Méthode | Quality | Friction | Tracking |
|---------|---------|----------|----------|
| Agent-workflow | + | High | Self-documenting (docs git) |
| Agile/CI/CD | Med | Low | GitHub issues |
| SWE-agent | Med | Low | Prose-only reviews |
| Manual review | Med | High | Humain fatigue |

### Recommandations Priorité

**High**:
1. CI/CD pour automate plan validation, tests
2. Rollback mechanism pour décisions framing docs
3. Error recovery: retry transient failures
4. Deployment automation: auto-merge config

**Medium**:
5. Template versioning systematic update
6. Parallel execution indépendant stories
7. Central state file (supplement derived state)
8. Training docs: vidéos, cheat sheets

**Low**:
9. Analytics: pipeline effectiveness
10. Plugin system: custom hooks
11. Mobile: ship confirmation
12. AI-assisted planning: réduit effort manuel

### Note globale

**8.8/10** — Excellent

- **Architectural**: 9/10 — Clean, tool-independent, docs complets, code qualité
- **Innovation**: 9.5/10 — Gates fichiers, mutation testing, multi-target
- **Usability**: 7/10 — Steep learning, high friction, discipline requise
- **Scalabilité**: 8.5/10 — File-based state scale, worktree isolation, gates manuels comme bottlenecks

**Verdict**: Paradigm shift dans AI-assisted development. Framework méthodologique complet, non juste outil. File-based gate architecture et anti-hallucination techniques innovants. Trade-off: friction pour qualité. Idéal systèmes complexes enterprise, moins approprié prototypes rapides.