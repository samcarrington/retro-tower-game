import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Entry wiring and the WebGL renderer are verified by browser smoke, not unit tests.
      exclude: ["src/main.ts", "src/render/pixi-renderer.ts"],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
    },
  },
});
