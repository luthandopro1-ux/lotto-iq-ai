# Rules of Engagement — Lotto IQ Project

## 1. Absolute Context Preservation

- Before initializing any text or script modifications, the active agent must ingest the latest `HANDOVER_REPORT.md` file from the repository root.
- Upon termination of an active session, the outgoing agent must document state parameters, unresolved code blocks, and deployment updates directly into a fresh `HANDOVER_REPORT.md` payload.

## 2. Human-in-the-Loop Enforcements

- AI agents operate strictly in an observational and branch-building capacity.
- No agent is permitted to perform a direct merge or force-push onto the `main`, `master`, or `develop` branches. All updates must flow through isolated feature branches subject to direct manual code-diff analysis by the Lead Engineer.

## 3. Crash and Exception Protocols

- Silent failure strategies are completely forbidden. If an endpoint times out, a database pooler hangs, or a compilation error occurs, the agent must freeze the workspace loop immediately.
- The agent must print the raw stack trace and wait for direct manual intervention rather than inserting dummy fallbacks or placeholder data structures.
