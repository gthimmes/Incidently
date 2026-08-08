import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    // Engine tests share one isolated SQLite db — run serially.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
