# Lotto IQ Supabase Deployment and Security Report

**Product:** Lotto IQ
**Developer and operator:** Lum Tech Solutions  
**Repository:** `luthandopro1-ux/lotto-iq-ai`  
**Report date:** 21 September 2026  
**Current release context:** Early Bird Beta and client-access security rollout

## Executive conclusion

The Lotto IQ Supabase design provides separate authentication, workspace ownership, entitlement control, protected administrator access, and row-level workspace isolation. The implementation has been checked with TypeScript validation, production build validation, and 38 automated tests.

A registration-related defect was identified after the main Early Bird pull request was merged. The original entitlement source constraint did not allow the later `early_bird_promo` source. This could cause an Early Bird claim to fail even when a client had already received a valid Free workspace. The user-facing flow also needed to distinguish normal Free registration from the optional Early Bird Premium claim.

The correction is implemented and tested in follow-up PR [#21](https://github.com/luthandopro1-ux/lotto-iq-ai/pull/21). Production should not be considered fully corrected until PR #21 is merged and the corrective Supabase migration in this report has been applied to the live project.

## Scope of the Supabase system

Supabase provides authentication, PostgreSQL storage, row-level security, server-side functions, and the account/workspace data model. A client creates an account with email and password. After authentication, the application creates one personal workspace and a Free entitlement. The client can then use the restricted customer dashboard.

Premium access is represented by a server-controlled entitlement. During the beta period, a client may explicitly claim Early Bird Premium. The claim is limited to the first 1,000 workspaces and expires at the end of the configured 30-day beta window.

The administrator console is separate from the client dashboard. Administrator authorization is resolved server-side through the administrator allowlist and does not depend on client-side navigation alone.

## Important distinction: registration versus Early Bird

Normal registration and Early Bird claiming are separate operations.

| Operation                             | Expected result                                            |
| ------------------------------------- | ---------------------------------------------------------- |
| New client registration               | Creates a Free workspace and Free entitlement.             |
| Opening the customer dashboard        | Shows the restricted Free client experience.               |
| Opening Premium during an active beta | Shows an optional Early Bird claim offer.                  |
| Not claiming Early Bird               | Client remains on the Free plan.                           |
| Explicitly claiming Early Bird        | Client receives Premium entitlement until the beta expiry. |
| Beta window inactive                  | Early Bird offer is hidden and cannot be claimed.          |

The Early Bird offer must never be treated as the registration result. Registration must succeed independently of whether the beta offer is active or full.

## Defect identified and correction

The original entitlement migration defined the `source` column with a check constraint that allowed `system`, `manual`, `stripe`, `google_play`, and `apple_app_store`. The Early Bird migration subsequently attempted to write `early_bird_promo`. PostgreSQL correctly rejected that value because it was not in the original constraint.

The corrective migration drops and recreates the source constraint with `early_bird_promo` included. The migration is idempotent with respect to the constraint name because it uses `DROP CONSTRAINT IF EXISTS` before recreating the approved constraint.

The application correction also requires the Early Bird status to report whether the beta window is currently enabled. The client interface hides the offer when the beta is inactive, when no slots remain, or when the status call fails safely.

## Required migration order

Apply the repository migrations in their normal chronological order. For the current rollout, the relevant sequence is shown below.

| Order | Migration                                                  | Purpose                                                                                          |
| ----: | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
|     1 | `20260918160000_premium_entitlements.sql`                  | Creates workspace entitlement storage and member-scoped read policy.                             |
|     2 | `20260920100000_harden_workspace_membership_isolation.sql` | Creates the personal workspace bootstrap function and strengthens workspace membership policies. |
|     3 | `20260920110000_early_bird_premium_promo.sql`              | Adds the capped Early Bird claim RPC and aggregate status RPC.                                   |
|     4 | `20260920115000_early_bird_beta.sql`                       | Adds the 30-day beta configuration, expiry fields, and active-window checks.                     |
|     5 | `20260921120000_prediction_temporal_audit.sql`             | Adds the prediction temporal audit controls.                                                     |
|     6 | `20260921130000_country_metadata_capture.sql`              | Adds validated two-letter country metadata capture for the caller’s own workspace.               |
|     7 | `20260921140000_fix_early_bird_entitlement_source.sql`     | Corrects the entitlement source constraint to allow `early_bird_promo`.                          |

If the earlier migrations have already been applied to the live Supabase project, apply migrations 6 and 7 as new migrations. Do not edit an already-applied migration in the Supabase migration history.

## Corrective SQL migration

The following file must be applied to the live project:

[`20260921140000_fix_early_bird_entitlement_source.sql`](../supabase/migrations/20260921140000_fix_early_bird_entitlement_source.sql)

Its effective database rule is:

```sql
CHECK (
  source IN (
    'system',
    'manual',
    'early_bird_promo',
    'stripe',
    'google_play',
    'apple_app_store'
  )
)
```

Run the migration in the Supabase SQL Editor or through the approved migration deployment process. Do not run it through an untrusted browser client or expose a service-role key.

## Supabase execution procedure

Before execution, confirm that the SQL is being run against the intended production Supabase project. Confirm that a recent database backup or recoverable point-in-time restore is available according to the project’s operational policy.

Apply the migration. Then inspect the resulting constraint with the following read-only query:

```sql
SELECT
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.workspace_entitlements'::regclass
  AND conname = 'workspace_entitlements_source_check';
```

The result must contain `early_bird_promo` in the constraint definition.

Verify that the beta configuration exists and is enabled:

```sql
SELECT
  id,
  label,
  starts_at,
  ends_at,
  max_workspaces,
  enabled
FROM public.beta_config
WHERE id = true;
```

The expected configuration is one row with `max_workspaces = 1000`, `enabled = true`, and an `ends_at` value later than `starts_at`. If the beta should start at a controlled time rather than immediately, update the configuration before opening registration to testers.

## Authentication and registration checks

Supabase Authentication must be configured with the production site URL and the correct redirect URL for the account recovery flow. Email confirmation behavior must be intentional. When confirmation is enabled, a newly registered client will not receive an application session until the confirmation link has been completed. The application correctly tells that client to check email rather than creating a workspace without an authenticated session.

After confirming a test email, perform the following verification with a test client account:

1. Create an account with a new email address.
2. Confirm the email if Supabase requires confirmation.
3. Sign in with the verified credentials.
4. Confirm that the account creates exactly one personal workspace.
5. Confirm that its entitlement has `plan_code = 'free'`, `status = 'active'`, and `source = 'system'`.
6. Open `/dashboard` and verify that the restricted Free dashboard loads.
7. Confirm that the account cannot open `/admin`.
8. Confirm that it cannot read another workspace’s formulas or entitlement.

A registration failure caused by missing email confirmation is an authentication configuration issue, not an Early Bird entitlement issue. A registration failure after a verified session should be investigated through the Supabase logs and the `bootstrap_personal_account` RPC result.

## Early Bird verification

Use a separate test account that has already completed workspace setup. Confirm that `get_early_bird_status()` returns an active status while the beta window is open.

Claim Premium once. The result must be idempotent: a second claim by the same workspace must return an already-claimed result rather than consuming another slot.

Inspect the test entitlement through the authenticated application or an authorized administrative SQL session. It should contain the following values:

```text
plan_code = premium
status = active
source = early_bird_promo
early_bird_expires_at = beta_config.ends_at
current_period_end = beta_config.ends_at
```

Do not use a production client account for destructive or quota-bound testing. The claim counter is limited to 1,000 workspaces and should not be artificially consumed during verification.

## Row-level security and privilege checks

Row-level security is a database control that limits which rows an authenticated request can read or modify. The application must not rely only on hidden navigation or React conditions.

Confirm the following controls:

| Area                    | Required control                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Workspace membership    | A client can read only rows associated with their own workspace membership.               |
| Workspace formulas      | A client can create and read formulas only within their own workspace and permitted role. |
| Entitlements            | A client can read only the entitlement associated with their own workspace membership.    |
| Early Bird status       | The public status RPC returns aggregate counts only.                                      |
| Early Bird claim        | The claim RPC requires an authenticated user and resolves the caller’s own workspace.     |
| Administrator functions | Administrator functions require server-side administrator authorization.                  |
| Passwords               | Passwords are handled by Supabase Auth and are never stored by the application.           |
| Service role            | Service-role credentials remain server-side and are never included in client bundles.     |

The security model should be tested with two separate client accounts. Account A must not be able to read Account B’s formulas, workspace settings, entitlements, or private strategy data.

## Country analytics privacy boundary

Geographic analytics use only a validated two-letter country code. The implementation does not store IP addresses, precise coordinates, names, email addresses, or individual browsing trails for this feature.

Country metadata is written only to the caller’s own workspace entitlement through `record_my_country_code(text)`. The administrator dashboard reads aggregate counts by country and groups missing values as `ZZ`.

This feature should be described as country distribution analytics, not precise client geolocation.

## Administrator bootstrap

The administrator account must already exist in Supabase Authentication before the allowlist script is run. The bootstrap document does not create or reset passwords.

Use the repository document [`bootstrap-super-admin.sql`](bootstrap-super-admin.sql) in the Supabase SQL Editor. Verify the email address before execution. After access is confirmed, reset the password through Supabase Authentication if necessary and enable multi-factor authentication for the administrator account.

Administrators must not receive or store client passwords. Password recovery remains a Supabase Auth operation.

## Application validation record

The corrected maintenance branch was validated locally with the following checks:

| Check                            | Result                              |
| -------------------------------- | ----------------------------------- |
| TypeScript typecheck             | Passed                              |
| Automated test suite             | 38 tests passed across 6 test files |
| npm audit                        | 0 vulnerabilities reported          |
| Production build                 | Passed                              |
| Git whitespace check             | Passed                              |
| Conflict-marker scan             | Passed                              |
| Client workspace isolation tests | Passed                              |
| Authorization tests              | Passed                              |
| Temporal integrity tests         | Passed                              |
| Cloudflare Worker dry run        | Passed                              |

These checks establish that the corrected branch installs, compiles, passes the available automated coverage, and produces a valid Worker dry-run artifact. They do not replace a live Supabase smoke test after migration deployment.

## Release status and required gate

The maintenance branch has not been merged or deployed. The release is ready for production only after the pull request is reviewed and merged through the normal release process, migration `20260921140000_fix_early_bird_entitlement_source.sql` is applied to the intended live Supabase project, and the authenticated acceptance checks below are completed.

Until those conditions are complete, the live environment should be treated as **not fully verified**. Normal client registration should remain a Free-plan operation, but the production correction has not been independently verified against the live Supabase project from this session.

## Final acceptance criteria

The rollout can be accepted when a verified test account can register, confirm email, sign in, receive exactly one Free workspace, open the Free dashboard, and remain isolated from other workspaces. A second test account can independently claim Early Bird Premium only while the beta is active. The claim must be idempotent, must not exceed the 1,000-workspace cap, and must carry the configured expiry. The administrator can view aggregate capacity and country analytics without exposing client passwords, IP addresses, or private workspace formulas.

**Prepared for Lum Tech Solutions.**

## References

[1]: https://supabase.com/docs/guides/auth "Supabase Auth documentation"
[2]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security documentation"
[3]: https://supabase.com/docs/guides/database/postgres/row-level-security#policies "Supabase database policy documentation"
