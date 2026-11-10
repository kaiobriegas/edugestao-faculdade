import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import-x";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "src/generated/**",
    ".local/**",
    "work/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.{ts,tsx,mjs}"],
    plugins: { "import-x": importPlugin },
    settings: {
      "import-x/extensions": [".js", ".jsx", ".mjs", ".ts", ".tsx"],
      "import-x/internal-regex": "^@/",
      "import-x/resolver-next": [createTypeScriptImportResolver({ project: "./tsconfig.json" })],
    },
    rules: {
      "import-x/no-cycle": ["error", { ignoreExternal: true }],
    },
  },
]);
