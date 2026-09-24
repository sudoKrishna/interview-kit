import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
  resolve: {
    alias: {
      "@prepkit/shared": path.resolve(__dirname, "../../packages/shared/src/kit.ts"),
    },
  },
});
