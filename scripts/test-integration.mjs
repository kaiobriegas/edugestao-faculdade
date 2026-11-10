import "dotenv/config";
import { spawnSync } from "node:child_process";
import pg from "pg";
const { Client } = pg;
import { testDatabaseUrl } from "../src/lib/test-database.ts";
const value = testDatabaseUrl();
const target = new URL(value);
const dbname = decodeURIComponent(target.pathname.slice(1));
const adminUrl = new URL(value);
adminUrl.pathname = "/postgres";
const admin = new Client({ connectionString: adminUrl.toString() });
try {
  await admin.connect();
  const existing = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbname],
  );
  if (!existing.rowCount) await admin.query(`CREATE DATABASE "${dbname}"`);
} finally {
  await admin.end();
}
const env = { ...process.env, DATABASE_URL: value, TEST_DATABASE_URL: value };
function run(file, args) {
  const result = spawnSync(process.execPath, [file, ...args], {
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
run("node_modules/vitest/vitest.mjs", ["run", "--project", "integration"]);
