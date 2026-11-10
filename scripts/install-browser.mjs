import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  ["node_modules/playwright/cli.js", "install", "chromium"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH:
        process.env.PLAYWRIGHT_BROWSERS_PATH || ".local/playwright",
    },
  },
);
process.exitCode = result.status ?? 1;
