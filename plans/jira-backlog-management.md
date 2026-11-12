# Plan d’amélioration — Pilotage du backlog Jira dans agent-workflow

**Dépôt cible** : `F:/Dev/Repository/agent-workflow`  
**Statut** : proposition à transformer en stories et plans validés avant implémentation.  
**But** : suivre dans Jira les stories restantes et leur progression, tout en gardant les critères produit et les décisions techniques dans le dépôt.

## Objectif et contrat

- Jira devient la référence des champs de pilotage du backlog : statut, priorité et assignation.
- Le dépôt reste la référence du contenu : user story, critères d’acceptation, recherche, design, architecture et décisions.
- Chaque story `s<number>-<slug>` est reliée à un ticket Jira stable. Les critères ne deviennent pas autant de tickets séparés.
- Le cycle existant de l’agent-workflow — worktree par story, validation du plan, revue, confirmation de livraison — reste en place.
- Jira reste facultatif : désactivé ou non configuré, le pipeline actuel continue à fonctionner sans appel réseau.

## État actuel vérifié

- `src/services/integration-service.mjs` crée un ticket Jira par requête REST; `JIRAService.syncStory()` est encore un stub qui retourne `synced: true`.
- `getIntegrationStatus()` retourne la configuration Jira complète; celle-ci peut contenir `api_token` et ne doit pas être affichée telle quelle.
- `createTicket()` réessaie les requêtes de création sans clé d’idempotence. Une réponse réseau ambiguë peut donc créer des doublons.
- `src/services/integration-service.test.mjs` vérifie notamment que le résultat est défini, mais ne prouve pas le contrat HTTP Jira ni une synchronisation réelle.
- `install.sh` installe les commandes, skills, agents et templates; il ne livre pas le service Jira ni sa configuration aux projets consommateurs.
- Les commandes utilisent tantôt `integrations.yml`, tantôt `integrations.yaml`. L’intégration doit avoir un seul chemin de configuration documenté.
- Les commandes actuelles supposent une hiérarchie Epic → Requirement → Task qui peut ne pas exister dans un projet Jira standard.

## Décisions proposées

1. **Une story produit = un ticket Jira.** L’issue type doit être configurable et validé contre les types disponibles dans le projet. Ne pas créer un Epic et une Requirement pour chaque story. Un Epic parent reste facultatif.
2. **Identifiant stable.** Utiliser le `story_id` comme marqueur Jira, par exemple le label `aw-story-s05-advanced-filters`. Enregistrer la clé et l’URL Jira dans `docs/integrations/<story-id>.md`; ne pas recopier le statut vivant dans ce fichier.
3. **Dépendances.** Reprendre les dépendances existantes des stories comme liens Jira `blocks`/`is blocked by` lorsque le projet les autorise. En cas d’impossibilité, conserver les références dans le ticket et signaler le lien non créé.
4. **Chemin installé recommandé.** Configuration de projet dans `.agent-workflow/integrations.yaml`; runtime installé dans `.agent-workflow/runtime/`. Garder les secrets dans l’environnement, jamais dans le YAML. Consigner ce choix dans un ADR si l’agent confirme qu’il s’agit d’un changement structurel.
5. **Statuts sémantiques configurables.** Configurer les destinations Jira pour `todo`, `in_progress`, `in_review`, `blocked` (facultatif) et `done`. Rechercher les transitions disponibles pour le ticket et utiliser leur ID; ne pas supposer que tous les workflows Jira ont les mêmes statuts ou transitions.
6. **Fin réelle, pas fin de revue.** Ne passer à `Done` qu’après confirmation de la fusion dans `/aw-ship`. Une revue réussie ou une PR ouverte reste `In Review` tant que la fusion n’est pas prouvée.
7. **Pas de synchronisation exhaustive.** Pas de webhook ni de copie bidirectionnelle des critères, des cases de plan ou du code. Les commandes AW lisent et mettent à jour uniquement les champs Jira définis ici.

## Stories candidates et critères d’acceptation

### A. Connecter Jira de façon installable et sûre

- Une installation projet Claude Code ou Codex inclut le runtime Jira et un modèle de configuration; l’étape `init` après une installation globale fait de même.
- `install`/`update` préserve une configuration projet existante et n’écrit ni ne supprime de secrets. Les fichiers gérés sont suivis par un manifeste; la configuration utilisateur n’est pas traitée comme un fichier géré à supprimer.
- La configuration utilise un chemin canonique unique et valide l’URL, la clé de projet, l’issue type et les variables requises (`JIRA_API_URL`, `JIRA_PROJECT_KEY`, `JIRA_EMAIL`, `JIRA_API_TOKEN`). Les noms manquants sont signalés sans afficher leurs valeurs.
- La commande de configuration peut vérifier l’identité Jira et l’accès au projet avant d’activer l’intégration.
- Une installation sans Jira configuré ou avec Jira désactivé ne fait aucun appel réseau et ne change pas le comportement du pipeline.
- Aucun token, en-tête `Authorization` ou valeur secrète n’apparaît dans `getIntegrationStatus()`, les logs, les erreurs, les sorties des commandes ou les tests.

### B. Importer et relier les stories au backlog

- Une commande d’import affiche d’abord un aperçu des tickets qui seraient créés ou reliés; une création en lot exige une confirmation explicite.
- L’import traite uniquement les identifiants de stories demandés. Il ne déduit pas seul qu’une story est terminée ou incomplète à partir des cases Markdown.
- Pour une story déjà reliée, ou déjà trouvée dans Jira par son marqueur stable, la commande réutilise le ticket au lieu d’en créer un autre. Plusieurs correspondances sont signalées comme ambiguës et ne déclenchent aucune création.
- Le résumé, la user story, les critères d’acceptation et les dépendances sont transmis au ticket dans un format accepté par l’API Jira configurée.
- Après succès, la clé et l’URL Jira sont enregistrées dans `docs/integrations/<story-id>.md`. Une seconde exécution ne crée pas de doublon.
- Après une réponse réseau ambiguë à une création, le service recherche d’abord le marqueur de story avant toute nouvelle tentative. Les retries sont limités aux erreurs transitoires; une erreur permanente ne déclenche pas de retry aveugle.
- Une panne Jira ou une validation refusée produit un message actionnable et ne prétend jamais que le ticket a été créé.

### C. Synchroniser Jira avec le cycle de livraison

- Au démarrage du travail d’une story reliée, le pipeline peut faire passer le ticket vers le statut configuré `in_progress`.
- Au début de la revue ou après ouverture d’une PR, le ticket passe vers `in_review`.
- Une revue refusée ne marque jamais le ticket terminé; un statut `blocked` n’est utilisé que s’il est configuré et applicable.
- Le ticket passe à `done` seulement quand `/aw-ship` a vérifié que la PR est fusionnée. L’ouverture d’une PR en mode manuel ne suffit pas.
- Le ticket reçoit le lien de la PR après sa création; la fusion et le résultat de livraison sont consignés dans Jira sans recopier l’historique complet du pipeline.
- `/aw-integrate-status` affiche les clés et statuts Jira actuels des stories liées. `/aw-status` distingue clairement l’état local du pipeline et l’état Jira; il n’invente pas un état distant si Jira est indisponible.
- Si une mise à jour Jira échoue pendant le pipeline, l’état local du travail n’est pas perdu et l’échec de synchronisation est signalé explicitement. Les opérations Jira explicites de configuration/import, elles, échouent sans annoncer de succès.

## Séquencement d’implémentation

1. **Research/design/plan dans agent-workflow.** Vérifier les contrats Jira Cloud actuels (authentification, recherche par marqueur, création, transitions et liens), le format des descriptions et les capacités du projet cible. Confirmer le chemin de configuration et l’installation projet/global. Ne pas coder avant validation du plan selon `src/AGENTS.md`.
2. **Story A — connexion et installation.** Unifier `.yaml`/`.yml`, valider la configuration, isoler les secrets, redacter les sorties, installer le runtime et son modèle sans écraser la configuration du projet.
3. **Story B — import et liaison idempotents.** Ajouter recherche/lecture/création de tickets, aperçu avant écriture, liaison au fichier d’intégration de story et correspondance des dépendances.
4. **Story C — cycle Jira.** Remplacer `syncStory()` par des opérations réelles, ajouter la lecture des statuts/transitions, puis relier les événements de pipeline au statut et à la PR.
5. **Documentation et adoption.** Mettre à jour `/aw-integrate-configure`, `/aw-integrate-jira`, `/aw-integrate-link`, `/aw-integrate-status`, `/aw-orchestrator`, `/aw-status`, `/aw-ship`, les templates et `docs/integration-guide.md`. Corriger `plans/INTEGRATION_IMPLEMENTATION.md` pour qu’il décrive l’état réellement livré.

## Fichiers probablement concernés

- `src/services/integration-service.mjs` et `src/services/integration-service.test.mjs`
- `src/config/integrations.yaml` et l’ancien `src/config/integrations.yml` (un seul contrat final; migrer les références)
- `install.sh` et, si nécessaire, `bin/aw-build.mjs` pour préserver le support des cibles Claude/Codex et du mode global suivi de `init`
- `src/commands/aw-integrate-configure.md`, `aw-integrate-jira.md`, `aw-integrate-link.md`, `aw-integrate-status.md`, `aw-orchestrator.md`, `aw-status.md`, `aw-ship.md`
- `src/templates/integrations/*`, `docs/integration-guide.md`, `docs/integrations/README.md`, `plans/INTEGRATION_IMPLEMENTATION.md`
- `docs/decisions/` si le choix du runtime ou du format de configuration nécessite un ADR

## Stratégie de test

- Tests du service avec `fetch` simulé : URL, méthode, payload Jira, auth présente mais token absent des sorties, réponses valides et erreurs.
- Tests de configuration : Jira désactivé, variables absentes, URL invalide, issue type/statut non disponible, expansion de variables d’environnement et chemin de configuration unique.
- Tests d’import comportementaux : aperçu sans écriture, confirmation, réutilisation d’un ticket existant, ré-exécution sans doublon, résultat ambigu, timeout de création suivi d’une recherche, liaison des dépendances.
- Tests de transitions : transitions disponibles/inexistantes, refus API, statut `Done` interdit avant preuve de fusion, PR ouverte mais non fusionnée, mode Jira désactivé.
- Smoke test de l’installateur dans un répertoire temporaire : Claude, Codex, `update`, `init` après installation globale, préservation de la configuration locale et suppression uniquement des fichiers gérés.
- Aucun test permanent ne contacte le Jira réel. Le smoke test réel, si autorisé, est manuel et utilise des variables d’environnement hors dépôt.
- Garder des tests de comportement ciblés, environ 25 par story au maximum sauf justification, conformément à `src/AGENTS.md`.

## Non-objectifs et interdicts

- Ne pas remplacer le cycle Research → Design → Plan → Execute → Review → Ship par le workflow d’un autre framework.
- Ne pas créer automatiquement des tickets pour toutes les stories historiques ni convertir chaque critère en sous-tâche.
- Ne pas marquer `Done` à la validation du plan, à la fin de l’implémentation ou à l’ouverture de la PR.
- Ne pas bloquer le pipeline local parce que Jira est désactivé ou momentanément indisponible; ne jamais masquer l’échec distant.
- Ne pas stocker de token dans les fichiers suivis par Git, un log, une issue de test ou une sortie de statut.
- Ne pas écraser, supprimer ou réinitialiser une configuration Jira locale pendant `update` ou `init`.

## Adoption dans on-mange-quoi

Après livraison de l’intégration générique, réconcilier d’abord les statuts de `docs/stories.md` avec le code et sélectionner explicitement les stories réellement restantes. Les cases actuelles ne sont pas une source fiable pour un import automatique. Importer ces seules stories par aperçu confirmé, puis vérifier les liens et dépendances dans Jira avant d’activer la synchronisation automatique du cycle.

## Passage à l’agent d’implémentation

Ce plan est un brief, pas une autorisation de modifier directement le code. L’agent doit suivre `src/AGENTS.md` : transformer le scope en stories shippables dans `docs/stories.md`, produire recherche/design si requis, créer des plans par story dans `docs/plans/`, obtenir leur validation, puis exécuter, revoir et livrer avec le pipeline existant. Les identifiants de story définitifs sont attribués par ce dépôt; ne pas inventer ni réutiliser un ID déjà pris.
