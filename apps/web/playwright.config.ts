import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: [
    {
      command: "MATCH_TARGET_SCORE=1 BOT_INSTANT_ACTIONS=true THANI_ENABLED=false pnpm --filter @twenty-eight/server start",
      url: "http://localhost:3001/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @twenty-eight/web dev -- --host 127.0.0.1 --port 5173",
      url: "http://localhost:5173",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
