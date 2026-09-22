import { defineTask } from "nitro/task";

export default defineTask({
  meta: {
    name: "research:tick",
    description: "Run the scheduled Lotto IQ research comparison on Monday, Wednesday, and Friday.",
  },
  async run() {
    try {
      const { serverDb } = await import("@/lib/db.server");
      const { startResearchRun } = await import("@/lib/research.server");
      const result = await startResearchRun(serverDb());
      return { result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("research:tick failed", message);
      return { result: { error: message } };
    }
  },
});
