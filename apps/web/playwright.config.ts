import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: [
    {
      command: "pnpm --filter @twenty-eight/server start",
      url: "http://localhost:3001/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @twenty-eight/web dev -- --host 127.0.0.1 --port 5173",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
