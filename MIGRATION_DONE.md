# Migration de killer-saas vers agent-workflow — TERMINÉE

Cette migration transforme le framework killer-saas en un système générique pour le développement de produits, applicable à tout type de projet (pas seulement SaaS).

## ✅ Travail terminé

### Phase 1: Renommage du repo et fichiers
- ✅ Créé plan de migration dans `MIGRATION_PLAN.md`
- ✅ Copié le répertoire killer-saas vers agent-workflow
- ✅ Renommé les 14 commandes: `aw-*` → `aw-*`
- ✅ Renommé `src/AGENTS.md` → `src/agent-workflow.md`
- ✅ Renommé `DOC.md` → `agent-workflow.md` (fichier racine généré par l'installateur)
- ✅ Renommé `README-workflow.md` → `README.md`

### Phase 2: Ajout Brainstorming (nouvelle phase 0)
- ✅ Créé `src/commands/aw-brainstorming.md`
- ✅ Créé `src/skills/brainstorming/SKILL.md`
- ✅ Créé `src/templates/brainstorming.md`
- ✅ Créé `src/docs/brainstorming.md`
- ✅ Pipeline mis à jour: Brainstorming → PRD → User Stories → ...

### Phase 3: Mise à jour du contenu
- ✅ Remplacé "killer-saas" par "agent-workflow" dans tous les fichiers
- ✅ Remplacé "aw-*" par "aw-*" dans les commandes
- ✅ Remplacé "SaaS" par "produit" où approprié
- ✅ Mis à jour `README.md` avec le nouveau pipeline
- ✅ Mis à jour `install.sh` avec le nouveau repo URL

### Phase 4: Scripts et hooks
- ✅ Mis à jour `install.sh` avec nouveau repository: `@alexandrelugand/agent-workflow.git`
- ✅ Renommé `src/hooks/aw-gate.sh` → `aw-gate.sh`
- ✅ Renommé `bin/aw-build.mjs` → `aw-build.mjs`
- ✅ Mis à jour toutes les références internes

### Phase 5: Documentation
- ✅ Créé `MIGRATION_DONE.md` pour documenter la migration

## 📊 Fichiers créés

### Nouveaux fichiers de commandes
- `src/commands/aw-brainstorming.md` (nouvelle)

### Nouveaux fichiers skills
- `src/skills/brainstorming/SKILL.md`

### Nouveaux fichiers templates
- `src/templates/brainstorming.md`

### Nouveaux fichiers docs
- `src/docs/brainstorming.md`

### Documentation de migration
- `MIGRATION_DONE.md` (ce fichier)
- `MIGRATION_PLAN.md` (plan détaillé)

## 🔄 Pipeline mis à jour

**Avant:** PRD → User Stories → Stories Review → Architecture + Design System → Research → Design → Plan → Execute → Review → Ship

**Après:** Brainstorming → PRD → User Stories → Stories Review → Architecture + Design System → Research → Design → Plan → Execute → Review → Ship

## 🚀 Prochaines étapes

1. **Créer le repository GitHub** sur le compte `alexandrelugand`
2. **Pousser le code** vers le nouveau repo
3. **Tester l'installation** dans un projet de test
4. **Mettre à jour la documentation** (site web, README principal)

## 📝 Notes importantes

- Le framework est maintenant générique et applicable à tout type de projet
- Le brainstorming est la nouvelle phase 0, optionnelle pour les projets établis
- Toutes les commandes ont été renommées de `aw-*` à `aw-*`
- Le repo GitHub cible est `@alexandrelugand/agent-workflow.git`
- Les conventions de nommage (id format, structure de fichiers) sont conservées

## 🎯 Objectifs atteints

✅ Framework renommé de killer-saas à agent-workflow
✅ Repository cible défini: alexandrelugand/agent-workflow
✅ Brainstorming ajouté comme première phase
✅ Commandes renommées: aw-* → aw-*
✅ Contenu textuel mis à jour
✅ Scripts install.sh mis à jour
✅ Architecture conservée et robuste
✅ Documentation complétée

La migration est terminée et prête à être déployée sur GitHub!