# Security Controls

**Owner:** Lum Tech Solutions

Lotto IQ separates authentication, authorization, audit, and password recovery. Supabase Auth owns passwords, email verification, sessions, and recovery tokens. The application never stores or displays a client password, and an administrator cannot read a password from the operator console.

The security migration adds `account_access_controls`, which stores an account status of `active`, `suspended`, or `revoked`, the reason, the administrator who changed it, and the timestamp. The protected `admin_set_account_access` function rejects non-administrators and cannot be used to change another administrator. A suspended or revoked account is rejected by the server authorization layer before workspace or Premium data is loaded. Restore returns the account to `active`.

Every revoke, suspend, restore, and future security-setting action is written to `admin_audit_log`. The administrator console displays account totals, controlled-account totals, recent access controls, and recent administrator actions. This is an operational control surface; it does not expose client formulas, passwords, or another client's workspace.

Password recovery is self-service for both clients and administrators. The account page uses Supabase Auth's recovery email flow and does not reveal whether an email address exists. The recovery link returns to the account page, where the authenticated recovery session can set a new password. Production Supabase Auth should have email confirmation, rate limits, secure redirect URLs, breached-password protection, and MFA enabled according to the organization's policy.

Before production, apply `20260919223000_security_controls.sql`, verify the administrator allowlist, test suspension and restore with two separate test accounts, confirm that a suspended account cannot call protected server functions, and confirm that a customer cannot read `account_access_controls` or `admin_audit_log` directly. Review the audit-log retention period and define an incident-response process for revocation decisions.
