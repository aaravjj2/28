import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: [
      "packages/**/src/**/*.test.ts",
      "apps/server/src/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
      "apps/web/src/**/*.test.tsx",
    ],
    setupFiles: ["./apps/web/src/test/setup.ts"],
  },
});
