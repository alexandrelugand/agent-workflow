# Plan d'implémentation pour l'intégration JIRA/GitHub/Telegram

## Contexte

Le projet **agent-workflow** est un pipeline agentic complet pour le développement de produits. Actuellement, des intégrations existent pour JIRA, GitHub et Telegram (fichiers dans `src/skills/integrations/` et `src/commands/aw-integrate-*.md`), mais elles nécessitent une amélioration pour offrir une expérience plus fluide et intégrée.

### Problème actuel

1. **Intégrations disjointes** : Chaque intégration est gérée séparément via des commandes distinctes (/aw-integrate-github, /aw-integrate-jira) qui ne communiquent pas entre elles
2. **Documentation incomplète** : Les documentations existantes décrivent des patterns, mais pas les workflows complets
3. **Orchestration limitée** : Le pipeline ne synchronise pas automatiquement les intégrations entre les phases
4. **Notifications fragmentées** : Telegram notifier est un skill isolé, non orchestré avec le flux global

### Objectif

Créer un **système d'intégration centralisé** qui :
- Fournit une interface unifiée pour activer/désactiver et configurer JIRA/GitHub/Telegram
- Synchronise automatiquement les intégrations avec chaque phase du pipeline
- Orchestre les notifications Telegram pendant le cycle complet
- Maintient la traçabilité entre les tickets JIRA/GitHub et les stories du pipeline

## Architecture existante

### Pipeline actuel (en ordre)
```
Brainstorming → PRD → Stories → Stories Review → Architecture → Design System
↓
Research → Design → Plan → Execute → Review → Ship
```

### Agents principaux
- `implementer` : Exécute les tâches, écrit le code, teste
- `reviewer` : Révision anti-hallucination, gate
- `worktree-manager` : Gère les worktrees pour chaque story
- `stories-reviewer` : Révision de la breakdown de stories

### Intégrations existantes
1. **GitHub** (github-adapter.md) : Création d'issues et PRs
2. **JIRA** (jira-adapter.md) : Création de tickets (Epic, Requirement, Task)
3. **Telegram** (telegram-notifier.md) : Notifications en temps réel

### Points d'intégration critiques
- `/aw-orchestrator` : Point central qui orchestre le cycle complet
- `/aw-execute` : Phase où les tâches sont exécutées
- `/aw-review` : Phase de révision et gate
- `/aw-ship` : Phase de création de PR et déploiement

## Proposition d'architecture

### Nouvelle architecture d'intégration

```
┌─────────────────────────────────────────────────────────────┐
│                   Unified Integration Config                 │
│                src/config/integrations.yaml                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           Centralized Integration Service                    │
│    src/services/integration-service.js (new)                │
└─────────────────────────────────────────────────────────────┘
                              ↓
        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
┌───────────────────┐                 ┌───────────────────┐
│   JIRA Service    │                 │   GitHub Service  │
│ (jira-adapter.md) │                 │(github-adapter.md)│
└───────────────────┘                 └───────────────────┘
        ↓                                       ↓
        └───────────────┬───────────────────────┘
                        ↓
            ┌───────────────────────┐
            │  Notification Router  │
            │   (telegram-*.md)     │
            └───────────────────────┘
```

## Plan d'implémentation

### Phase 1 : Configurateur centralisé

**Fichier :** `src/config/integrations.yaml`

```yaml
integrations:
  enabled: true

  jira:
    enabled: false
    api_url: "https://your-domain.atlassian.net"
    api_token: "${JIRA_API_TOKEN}"
    email: "${JIRA_EMAIL}"
    project_key: "PROJ"
    epics:
      prefix: "EPIC"
    requirements:
      prefix: "REQ"
    tasks:
      prefix: "TASK"

  github:
    enabled: false
    api_url: "https://api.github.com"
    personal_access_token: "${GITHUB_TOKEN}"
    repo: "org/repo"
    default_branch: "main"
    issue_prefix: "ISS-"

  telegram:
    enabled: false
    bot_token: "${TELEGRAM_BOT_TOKEN}"
    user_id: "${TELEGRAM_USER_ID}"
    notify_on:
      compilation_requests: true
      task_progress: true
      task_completed: true
      pr_created: true
      review_passed: false
      review_failed: true
      pipeline_started: true
```

**Actions :**
- Créer le fichier `src/config/integrations.yaml`
- Modifier les templates existants pour inclure la configuration
- Ajouter des hooks de validation dans `/aw-help`

### Phase 2 : Service d'intégration centralisé

**Fichier :** `src/services/integration-service.mjs`

Fonctionnalités :
1. **Configuration** : Charger et valider la configuration
2. **JIRA Service** : Wrapper autour du jira-adapter.md
3. **GitHub Service** : Wrapper autour du github-adapter.md
4. **Notification Router** : Orchestrateur des notifications Telegram
5. **Synchronization** : Synchroniser les tickets avec les phases du pipeline
6. **Error Handling** : Gestion unifiée des erreurs d'intégration

**Méthodes clés :**
- `init()`: Initialiser le service
- `createJiraTicket(ticketType, data)`: Créer un ticket JIRA
- `createGitHubIssue(data)`: Créer une issue GitHub
- `notifyTelegram(event, context)`: Envoyer une notification
- `syncStoryWithJira(storyId)`: Synchroniser une story avec JIRA
- `syncStoryWithGitHub(storyId)`: Synchroniser une story avec GitHub
- `getIntegrationStatus()`: Vérifier l'état des intégrations

### Phase 3 : Commandes d'orchestration intégrées

**Nouvelles commandes à créer :**

1. **`/aw-integrate-configure`**
   - Menu interactif pour activer/désactiver et configurer les intégrations
   - Valide les configurations (API tokens, URLs, etc.)
   - Sauvegarde dans `.env*` et `src/config/integrations.yaml`

2. **`/aw-integrate-status`**
   - Affiche l'état actuel de chaque intégration
   - Liste les stories connectées à JIRA/GitHub
   - Affiche les notifications en attente

3. **`/aw-integrate-link`**
   - Link manuel entre une story et un ticket JIRA/GitHub existant
   - Met à jour les fichiers `docs/prd.md`, `docs/stories.md`
   - Crée les liaisons nécessaires

4. **`/aw-integrate-unlink`**
   - Désactive une intégration pour une story spécifique

### Phase 4 : Intégration dans le pipeline

**Modifier `/aw-orchestrator.md`** pour inclure :

```markdown
## Phase 0 — Intégration Validation

1. Vérifier les intégrations activées dans `src/config/integrations.yaml`
2. Pour chaque intégration activée :
   - JIRA : Créer les Epics depuis le PRD
   - GitHub : Créer les issues depuis les stories
3. Documenter les tickets créés dans `docs/integrations/<story-id>.md`
4. Lancer les notifications Telegram si activées

## Phase 1 — Research

Si JIRA activé : Synchroniser les tickets en attente

## Phase 2 — Design

Si GitHub activé : Créer les issues de design

## Phase 3 — Plan

Si JIRA : Créer les Tasks liées aux Requirements

## Phase 4 — Execute

Si Telegram activé : Envoyer des notifications de progression

## Phase 5 — Review

Si Telegram activé : Envoyer les résultats de révision
Si JIRA : Mettre à jour le statut du ticket

## Phase 6 — Ship

Si GitHub activé : Créer le PR et commenter sur l'issue
Si Telegram activé : Notification de succès
```

### Phase 5 : Skills améliorés

**Modifier les skills existants :**

1. **`src/skills/integrations/jira-adapter.md`**
   - Ajouter des callbacks pour les événements du pipeline
   - Intégrer le service centralisé
   - Gérer les erreurs de manière robuste

2. **`src/skills/integrations/github-adapter.md`**
   - Même amélioration que JIRA

3. **`src/skills/integrations/telegram-notifier.md`**
   - Orchestration centralisée par le service
   - Templates contextuels pour chaque phase
   - Gestion des erreurs de manière unifiée

### Phase 6 : Templates et documentation

**Nouveaux fichiers de templates :**

1. **`src/templates/integration-setup.md`**
   - Guide complet de configuration
   - Exemples de configuration pour différentes plateformes

2. **`src/templates/integration-sync.md`**
   - Documentation des synchronisations automatiques
   - Liste des événements et leur mappage

3. **`src/templates/integration-config.md`**
   - Configuration minimale
   - Valeurs par défaut
   - Bonnes pratiques

**Mise à jour des fichiers existants :**
- `docs/integrations/` : Documentation des integrations
- `docs/integration-guide.md` : Guide utilisateur complet

### Phase 7 : Hooks et validation

**Nouveaux fichiers :**

1. **`src/hooks/pre-integrate.sh`**
   - Validation avant lancement des intégrations
   - Vérification des configurations

2. **`src/hooks/post-integrate.sh`**
   - Rapports après les synchronisations
   - Logs détaillés

3. **`src/hooks/post-prd.md`**
   - Post-intégration après la création du PRD

4. **`src/hooks/post-story.md`**
   - Post-intégration après chaque story

### Phase 8 : Tests et documentation

1. **Tests unitaires pour Integration Service**
2. **Tests d'intégration pour chaque service**
3. **Documentation des patterns d'utilisation**
4. **Exemples de scénarios complets**

## Fichiers critiques à modifier/ créer

### Créés
- `src/config/integrations.yaml`
- `src/services/integration-service.mjs`
- `src/commands/aw-integrate-configure.md`
- `src/commands/aw-integrate-status.md`
- `src/commands/aw-integrate-link.md`
- `src/commands/aw-integrate-unlink.md`
- `src/templates/integration-setup.md`
- `src/templates/integration-sync.md`
- `src/templates/integration-config.md`
- `docs/integrations/README.md`
- `docs/integration-guide.md`

### Modifiés
- `src/commands/aw-orchestrator.md`
- `src/skills/integrations/jira-adapter.md`
- `src/skills/integrations/github-adapter.md`
- `src/skills/integrations/telegram-notifier.md`
- `docs/prd.md` (ajouter section d'intégrations)
- `docs/stories.md` (ajouter liens vers tickets)
- `src/hooks/pre-integrate.sh`
- `src/hooks/post-integrate.sh`
- `src/hooks/post-prd.md`
- `src/hooks/post-story.md`

## Stratégie de migration

1. **Phase 0** : Configuration du fichier `integrations.yaml`
2. **Phase 1** : Création du service d'intégration centralisé
3. **Phase 2** : Mise à jour des commandes existantes
4. **Phase 3** : Intégration dans `/aw-orchestrator`
5. **Phase 4** : Amélioration des skills
6. **Phase 5** : Tests et documentation
7. **Phase 6** : Mise en production progressive

## Cas d'utilisation

### Scénario 1 : Workflow complet avec JIRA
```
1. /aw-prd "mon-app"
2. /aw-integrate-configure (activer JIRA)
3. /aw-integrate-configure (configurer JIRA)
4. /aw-stories
5. /aw-orchestrator s01
   - Crée EPIC-100 dans JIRA
   - Crée REQ-1001 dans JIRA
   - Crée ISS-1001 dans GitHub
   - Notifications Telegram pendant l'exécution
   - PR GitHub créé
6. /aw-ship
```

### Scénario 2 : Workflow sans JIRA, avec GitHub et Telegram
```
1. /aw-prd "mon-site"
2. /aw-integrate-configure (activer GitHub)
3. /aw-integrate-configure (configurer GitHub)
4. /aw-integrate-configure (activer Telegram)
5. /aw-stories
6. /aw-orchestrator s01
   - Crée ISS-1001 dans GitHub
   - Notifications Telegram pendant l'exécution
   - PR GitHub créé
```

### Scénario 3 : Workflow avec JIRA existants
```
1. /aw-integrate-link s01 EPIC-100
   - Lie la story s01 à l'Epic JIRA existant
2. /aw-integrate-link s01 REQ-1001
   - Lie la story à la Requirement JIRA
3. /aw-orchestrator s01
   - Utilise les tickets existants
   - Met à jour les statuts
```

## Vérification

### Tests manuels
1. Configuration complète avec JIRA actif
2. Configuration complète avec GitHub actif
3. Configuration avec Telegram activé
4. Configuration avec toutes les intégrations
5. Workflow sans intégrations
6. Erreurs de configuration
7. Interruptions pendant les intégrations

### Vérification des fonctionnalités
1. Les tickets JIRA sont créés dans le bon ordre (Epic → Requirement → Task)
2. Les issues GitHub sont créées avec les bons labels
3. Les notifications Telegram contiennent les bonnes informations
4. Les liens entre stories et tickets sont maintenus
5. Les erreurs sont gérées et documentées
6. La configuration peut être modifiée sans redémarrer le pipeline

## Estimations de temps

- Phase 1 : Configuration : 1h
- Phase 2 : Service centralisé : 3h
- Phase 3 : Commandes d'orchestration : 4h
- Phase 4 : Intégration dans pipeline : 4h
- Phase 5 : Skills améliorés : 4h
- Phase 6 : Templates et documentation : 3h
- Phase 7 : Hooks et validation : 3h
- Phase 8 : Tests : 4h

**Total estimé : 26 heures**

## Risques et mitigation

1. **Risque : Break des workflows existants**
   - Mitigation : Versionnement, tests, rollback planifié

2. **Risque : Complexité accrue**
   - Mitigation : Documentation complète, exemples, onboarding

3. **Risque : Erreurs d'API (JIRA/GitHub)**
   - Mitigation : Gestion unifiée des erreurs, logs détaillés, modes fallback

4. **Risque : Sécurité (tokens API)**
   - Mitigation : Never hardcode tokens, use environment variables, encryption