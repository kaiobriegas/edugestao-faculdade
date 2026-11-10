import { testDatabaseUrl } from "./src/lib/test-database";
import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= ".local/playwright";
const databaseUrl = testDatabaseUrl();
export default defineConfig({
  globalSetup: "./tests/e2e/global-setup.ts",
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:3001", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001/login",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      DATABASE_URL: databaseUrl,
      APP_URL: "http://127.0.0.1:3001",
      AUTH_SECRET: process.env.AUTH_SECRET!,
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1025",
      STORAGE_PRIVATE_DIR: ".local/e2e-storage",
    },
  },
});
