import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run due monitors every 15 minutes (the minimum check frequency)
crons.interval("run due monitors", { minutes: 15 }, internal.runner.index.runDueMonitors, {});

// Send daily digest emails at 8 AM UTC
crons.daily("daily digest emails", { hourUTC: 8, minuteUTC: 0 }, internal.digestCron.sendAllDigests, {});

// Send weekly health summary every Monday at 9 AM UTC
crons.weekly(
  "weekly health summaries",
  { dayOfWeek: "monday", hourUTC: 9, minuteUTC: 0 },
  internal.weeklyCron.sendAllWeeklySummaries,
  {},
);

export default crons;
