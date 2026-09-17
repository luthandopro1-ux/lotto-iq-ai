import { createServerFn } from "@tanstack/react-start";
import { adminGuard } from "@/lib/admin-guard";

/** Recent research reports, newest first. */
export const listResearchReportsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { serverDb } = await import("@/lib/db.server");
  const { listResearchReports } = await import("@/lib/research.server");
  return listResearchReports(serverDb());
});

/** Manually kick off a research run (normally only the weekly cron does this). */
export const triggerResearchNow = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .handler(async () => {
    const { serverDb } = await import("@/lib/db.server");
    const { startWeeklyResearch } = await import("@/lib/research.server");
    return startWeeklyResearch(serverDb());
  });
