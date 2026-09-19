# Lotto IQ AI Client Access Security Notes

**Developer and maintainer:** Lum Tech Solutions
**Review date:** 19 September 2026
**Canonical repository:** `luthandopro1-ux/lotto-iq-ai`

## Implemented boundary

The customer dashboard now obtains its data through `getCustomerDashboard`, a server function protected by `requireAccessContext`. The server resolves the caller from the existing Supabase Auth token and workspace entitlement model. It returns only a client-safe projection: recent draw results, the current prediction pool, hot and cold ball slices, the seven-ball ranking, three product-video records, and the caller's own workspace formulas. The projection explicitly marks the ledger, strategy upload, ensemble, statistics wheel, and candidate-description surfaces as unavailable to the client dashboard.

Formula records are stored in `workspace_formulas` with a `workspace_id` foreign key. Supabase Row Level Security permits reads only to workspace members and permits writes only to owner/editor members. The server checks the entitlement-derived formula limit before inserting a record: three for Free and five for Premium or administrator access. The query never selects another workspace's formulas.

Global strategy definitions are no longer publicly readable. The new migration removes the public strategy policy and permits SELECT only when `public.is_administrator()` returns true. The existing operator write path remains separate. The admin route now resolves access server-side before enabling draw, strategy, and prediction queries; a non-administrator receives an access-denied view and the queries remain disabled.

The client shell no longer advertises operator-only modules such as Ledger, Strategies, Ensemble, Backtest, Research, or Admin in the general navigation. Direct-route hardening should continue across every legacy module before those routes are exposed to customer accounts in production.

The account form now requests a minimum ten-character password. Supabase Auth remains the authority for password validation, confirmation, recovery, rate limiting, and MFA configuration; this repository change does not claim those controls are enabled unless the Supabase project settings confirm them.

## Verification performed

The repository was installed and checked locally. `npm run typecheck` completed successfully. `npm test` completed successfully with 17 tests passing across the existing authorization and admin-guard suites. `npm run build` completed successfully and generated the Cloudflare/Nitro output. `npm run lint` completed with no errors and six pre-existing Fast Refresh warnings in shared UI components.

## Not yet claimed as complete

A real billing provider, webhook verification, cancellation/refund handling, and payment confirmation are not enabled by these changes. Premium data remains entitlement-gated; the Premium page must not imply a paid subscription is active without a verified entitlement record.

Production deployment must still apply the two new Supabase migrations, verify that the `administrators` allowlist contains only named operator accounts, configure MFA and recovery policy in Supabase Auth, and perform authenticated cross-account tests. Those tests should prove that Client A cannot read Client B's formulas, that a Free user cannot invoke Premium server functions, and that a standard authenticated user cannot read strategies or administrator data.

No commit or push was performed during this review. The local repository author name is set to `Lum Tech Solutions`; no email identity was invented.
