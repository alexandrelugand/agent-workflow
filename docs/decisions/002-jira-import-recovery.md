# ADR 002 — Jira import recovery

- Status: accepted
- Date: 2026-11-11
- Scope: story s02-jira-import

## Context

Jira issue creation is not safely repeatable after a timeout or server error: Jira's enhanced JQL index may lag, so a zero-result marker search does not prove that the create was rejected. Blind retries can create duplicate issues. The import also needs to survive process termination without storing credentials or story payloads in recovery state.

## Decision

- Before creating an issue, persist a non-secret pending marker containing only the validated story ID and its stable `aw-story-<story-id>` label under the ignored `.agent-workflow/jira-import-pending/` directory.
- If a create may have been accepted without returning a usable key, search all pages for the exact project and marker. Reconcile one match; stop and retain the marker for zero or multiple matches. Never automatically repeat a possibly accepted create.
- A definite HTTP 429 may be retried only after the same marker search returns zero matches, within the configured attempt bound, and after honoring `Retry-After`. Other HTTP failures are not retried.
- A retained pending marker blocks another create until exactly one marker match is linked locally or a human explicitly confirms that no Jira issue was created. Only these resolutions clear it.
- Derive browse URLs from a Jira site API URL. For scoped API bases, require optional secret-free `jira.browse_base_url` before writes. An optional `jira.epic_key` is used as the Jira parent only when it is a valid issue key; the importer never creates a parent.

## Considered options

- Retry any failed create after a marker search returns zero — rejected because enhanced JQL may be eventually consistent and a timed-out create may already exist.
- Retry only definite rate limiting — accepted because Jira's 429 response rejects the request and advertises a delay; still search first to avoid racing a prior attempt.
- Store the full request or credentials in the pending record — rejected because recovery needs only the validated identity marker and local runtime state must remain non-secret.
- Store the Jira API `self` URL as the local browse link — rejected because scoped-token API URLs are not user-facing Jira issue URLs.

## Consequences

- Unresolved imports fail closed and require explicit human resolution; a stale marker cannot silently cause a duplicate.
- A successful remote create remains pending until its local key and browse URL have been written, allowing a later run to reconcile after a local failure.
- Scoped-token users must configure a Jira site browse base before creating or manually linking an issue.
- Retry behavior and marker matching are tested without live Jira access; no credentials or story payloads are persisted in the marker.
