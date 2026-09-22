# Lotto IQ App Ecosystem — Code Quality Standards

**Owner and engineering authority:** Lum Tech Solutions
**Applies to:** the Lotto IQ AI repository, its application services, database migrations, tests, documentation, and deployment configuration.
**Status:** mandatory engineering standard.

This document defines the minimum quality, security, and production-readiness requirements for every change. A pull request must satisfy the applicable requirements before it may be merged.

This file complements [`RULES_OF_ENGAGEMENT.md`](./RULES_OF_ENGAGEMENT.md). `RULES_OF_ENGAGEMENT.md` governs agent operation, branch handling, human review, and crash-response procedure. This file governs software quality, security, testing, documentation, and release criteria. Neither document authorizes direct merging or overrides repository protection settings.

## 1. Architectural Scope

The canonical Lotto IQ application is currently a **React 19 and TanStack Start TypeScript application** using TanStack Query, Supabase, PostgreSQL Row-Level Security, and Cloudflare-compatible server execution. The standards below distinguish requirements that apply to the current TypeScript stack from requirements that apply only if a Python service is introduced.

No implementation may claim that a requirement has been satisfied when the relevant service or control does not exist. If a change reveals an architectural gap, the gap must be documented in the pull request and tracked as a separate implementation item.

## 2. Strict Structural Standards and Formatting

### 2.1 Python services

If a Python backend or analytics service is introduced, it must use asynchronous FastAPI patterns for network and database operations. Array, sequence-history, and matrix computations must use vectorized NumPy or Pandas operations where those libraries are appropriate. New nested loops with quadratic **O(N²)** behavior are prohibited for production-sized datasets. Any unavoidable non-vectorized algorithm must include a complexity justification and a bounded-input explanation in its technical documentation.

Python code must pass:

```bash
python -m py_compile <changed_python_files>
```

Python dependencies, type contracts, error handling, and operational limits must be explicit. A Python service must not be added merely to duplicate logic already implemented safely in the TypeScript application.

### 2.2 Frontend application

Frontend code must use React 19 and the repository’s TanStack Start conventions. Server state must be managed through TanStack Query rather than ad-hoc request state, manual polling, or data-fetching `useEffect` hooks.

New route-level server-state work must use `useSuspenseQuery` with a native React Error Boundary or the repository’s approved equivalent boundary. Existing `useQuery` routes are legacy code and must be migrated incrementally; a new feature must not expand the legacy pattern. A migration must preserve authentication gates, loading states, SSR behavior, refetch intervals, and error visibility.

`useEffect` remains permitted for genuine client-side effects such as subscriptions, document integration, focus management, and non-server browser APIs. It must not be used as a replacement for TanStack Query.

Frontend requirements also include:

- Use typed query keys and typed server-function contracts.
- Preserve keyboard access, visible focus states, responsive layouts, and reduced-motion behavior.
- Keep sensitive Premium, administrator, workspace, formula, and strategy data out of client responses unless the caller is authorized.
- Avoid duplicated information in dashboard layouts; current operational data must be visually distinct from historical data.
- Use explicit empty, loading, and error states. These states must not fabricate prediction, draw, payment, or account data.

### 2.3 Database and persistence

All Supabase access must preserve Row-Level Security. Every table containing user, workspace, entitlement, formula, telemetry, prediction, or administrative data must have an explicit RLS policy review in the migration or pull request that changes it.

Transactional operations must execute atomically. Multi-row claims, quota enforcement, entitlement changes, account suspension, and other race-sensitive operations must use a database transaction or a security-definer RPC with appropriate row-level locking and invariant checks. Client-side checks are not transaction controls.

Database changes must include:

- Explicit ownership and workspace-isolation predicates.
- Least-privilege grants and security-definer search-path controls where applicable.
- Constraints and indexes supporting the invariant being enforced.
- A rollback or live-safe migration plan.
- Tests or SQL verification queries for authorized and unauthorized paths.

Do not place private formulas, credentials, payment secrets, or raw user tracking data in public tables or client-readable payloads.

## 3. Security and Privacy

Authorization must be enforced on the server. A hidden navigation item, disabled button, or client-side role check is not an access control.

Every protected server function must resolve the authenticated caller and the caller’s workspace or administrator role before selecting or mutating protected data. Cross-workspace reads must be denied by both application authorization and database RLS.

Telemetry must remain aggregate and privacy-preserving. Capacity monitoring may count active sessions and busy periods, but it must not become an individual behavioral-tracking system without an explicit approved privacy requirement.

Secrets, passwords, service-role keys, access tokens, and payment credentials must never be committed to the repository, logs, screenshots, fixtures, or documentation.

Lottery analysis must be described as analysis or ranking. The application must not make guaranteed-outcome, certainty, or misleading financial claims.

## 4. Removal of AI Artifacts and Placeholders

The repository must remain professional and source-controlled. Do not commit comments, names, logs, or documentation that identify implementation as AI-generated or that expose internal agent instructions.

The following are prohibited:

- AI-generation labels such as `AI-generated structure`.
- Lazy tracing comments such as `fallback logic here`.
- Generic `TODO: implement`, `FIXME`, or unfinished execution notes.
- Clipped code, omitted blocks, or placeholder ellipses such as `...` used to stand in for missing implementation.
- Fake API responses, invented draw results, guessed payment amounts, or fabricated analytics presented as live data.

Normal language ellipses in user-facing copy and valid programming syntax such as JavaScript spread/rest operators are not considered clipped code. Any deferred work must be represented as a tracked issue or a complete, user-visible unavailable state with an explanatory reason.

## 5. Documentation and Function Contracts

Every new public function, server function, RPC wrapper, database helper, service endpoint, or security-sensitive utility must include descriptive documentation in the language’s native form:

- Python: a docstring describing parameters, data structures, exceptions, side effects, and return shape.
- TypeScript: TSDoc or a descriptive type and inline contract describing parameters, authorization assumptions, exceptions, side effects, and return shape.
- SQL: migration comments describing the invariant, RLS impact, locking or atomicity behavior, and rollout assumptions.

Documentation must describe actual behavior, not planned behavior. If a function returns a partial, unavailable, or privacy-filtered result, the contract must state that explicitly.

## 6. Production-Readiness Gate

Before committing a change, run the applicable checks from the repository root:

```bash
npm run typecheck
npm test
npm run lint
npm run build

git diff --check
! rg -n '^(<<<<<<<|=======|>>>>>>>)' src supabase docs
```

For Python changes, also run `python -m py_compile` against every changed Python file. For migration changes, review the generated SQL and run the project’s Supabase verification procedure against a disposable or approved environment before production deployment.

A pull request must report:

1. The files and behavior changed.
2. The authorization and RLS impact.
3. The tests and static checks executed, including results.
4. Any known warnings or architectural gaps.
5. The migration and rollback steps, if persistence changed.

A failing check may not be hidden by truncating output, suppressing errors, or marking an incomplete feature as successful.

## 7. Pull Request and Branch Controls

All work must be attributed to **Lum Tech Solutions**. Changes must be made on an isolated feature branch and reviewed through a pull request. Direct pushes, force-pushes, and direct merges to `main` are prohibited unless the repository owner explicitly changes the project rules.

Before opening or updating a pull request, the author must verify:

- The branch is based on the current `main`.
- The working tree is clean after the commit.
- No merge-conflict markers remain.
- No secrets or personal credentials are present in the diff.
- The pull request description accurately states what is implemented and what remains unavailable.

## 8. Standards Exceptions

An exception requires a written explanation in the pull request, the affected file or module, and an owner for remediation. The explanation must state why the standard cannot be applied, what compensating control exists, and when the exception will be reviewed.

The current repository’s existing `useQuery` routes are legacy code under incremental migration. New route-level server-state features must follow the `useSuspenseQuery` and Error Boundary standard; migration of existing routes must be handled as coordinated changes rather than through unsafe partial rewrites.

**Final rule:** never claim that the Lotto IQ platform is secure, live, or production-ready solely because it compiles. Security, authorization, data integrity, operational behavior, and user-visible truth must be verified independently.

— **Lum Tech Solutions Engineering**

> This file is the repository’s source of truth for code-quality expectations. When another document conflicts with it, the conflict must be resolved explicitly in a pull request rather than silently ignored.
>
> **Version:** 1.0
> **Last updated:** 2026-09-23
