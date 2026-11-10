import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };
export default defineConfig({
  resolve: { alias },
  test: { projects: [
    { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
    { extends: true, test: { name: "integration", include: ["tests/integration/**/*.test.ts"], environment: "node", fileParallelism: false, testTimeout: 15000, hookTimeout: 15000 } },
  ] },
});
