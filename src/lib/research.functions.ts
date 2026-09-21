import { createServerFn } from "@tanstack/react-start";
import { adminGuard } from "@/lib/admin-guard";

/** Recent research reports, newest first. */
export const listResearchReportsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { serverDb } = await import("@/lib/db.server");
  const { listResearchReports } = await import("@/lib/research.server");
  return listResearchReports(serverDb());
});

/** Manually kick off a research run (normally only the Mon/Wed/Fri schedule does this). */
export const triggerResearchNow = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .handler(async () => {
    const { serverDb } = await import("@/lib/db.server");
    const { startResearchRun } = await import("@/lib/research.server");
    return startResearchRun(serverDb());
  });
