"use node";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export type HttpCheckResult = {
  passed: boolean;
  httpStatus: number;
  durationMs: number;
  errorMessage?: string;
  keywordFound?: boolean;
};

export const runHttpCheck = internalAction({
  args: {
    runId: v.id("monitorRuns"),
    url: v.string(),
    keywordCheck: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { runId, url, keywordCheck } = args;
    let httpStatus = 0;
    let durationMs = 0;
    let passed = false;
    let errorMessage: string | undefined;
    let keywordFound: boolean | undefined;
    const startMs = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "WatchLayer-Monitor/1.0",
        },
      });
      clearTimeout(timeout);
      durationMs = Date.now() - startMs;
      httpStatus = response.status;
      const httpPassed = httpStatus >= 200 && httpStatus < 400;
      if (keywordCheck && keywordCheck.trim()) {
        const body = await response.text();
        keywordFound = body.includes(keywordCheck.trim());
        passed = httpPassed && keywordFound;
        if (httpPassed && !keywordFound) {
          errorMessage = `Keyword "${keywordCheck}" not found in response body`;
        }
      } else {
        passed = httpPassed;
      }
      if (!httpPassed) {
        errorMessage = `HTTP ${httpStatus}: Unexpected response status`;
      }
    } catch (err: unknown) {
      durationMs = Date.now() - startMs;
      passed = false;
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          errorMessage = "Request timed out after 30 seconds";
          httpStatus = 0;
        } else {
          errorMessage = err.message;
          httpStatus = 0;
        }
      } else {
        errorMessage = "Unknown error during HTTP check";
        httpStatus = 0;
      }
    }
    await ctx.runMutation(internal.runner.index.saveHttpCheckResult, {
      runId,
      passed,
      httpStatus,
      durationMs,
      errorMessage,
      keywordFound,
    });
  },
});