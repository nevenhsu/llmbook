import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/no-paid-ai.setup.ts"],
    restoreMocks: true,
    testTimeout: 60000,
    hookTimeout: 60000,
    maxConcurrency: 1,
  },
});
