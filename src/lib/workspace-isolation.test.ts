import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260920100000_harden_workspace_membership_isolation.sql",
  ),
  "utf8",
);
const accountFunction = readFileSync(
  resolve(process.cwd(), "src/lib/account.functions.ts"),
  "utf8",
);

describe("workspace isolation contract", () => {
  it("removes direct authenticated membership mutations", () => {
    expect(migration).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON public.workspace_members FROM authenticated",
    );
    expect(migration).toContain("DROP POLICY IF EXISTS workspace_members_insert_own");
    expect(migration).toContain("DROP POLICY IF EXISTS workspace_members_update_own");
    expect(migration).toContain("DROP POLICY IF EXISTS workspace_members_delete_own");
  });

  it("bootstraps the initial owner only through the authenticated RPC", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.bootstrap_personal_account");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("v_user_id uuid := auth.uid()");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.bootstrap_personal_account(text) TO authenticated",
    );
    expect(accountFunction).toContain('db.rpc("bootstrap_personal_account"');
    expect(accountFunction).not.toContain('.from("workspace_members")');
  });

  it("requires owner or editor role for settings writes", () => {
    expect(migration).toContain("CREATE POLICY workspace_settings_insert_owner_editor");
    expect(migration).toContain("CREATE POLICY workspace_settings_update_owner_editor");
    expect(migration).toContain("m.role IN ('owner', 'editor')");
  });
});
