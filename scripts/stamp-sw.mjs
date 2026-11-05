/**
 * Stamps the service worker with a unique build timestamp.
 * Replaces BUILD_TIME placeholder so every deploy busts all caches automatically.
 * Safe to run multiple times — skips if already stamped.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = join(__dirname, "..", "public", "sw.js");

if (!existsSync(swPath)) {
  console.log("[stamp-sw] sw.js not found, skipping.");
  process.exit(0);
}

const content = readFileSync(swPath, "utf8");

if (!content.includes("BUILD_TIME")) {
  console.log("[stamp-sw] Already stamped, skipping.");
  process.exit(0);
}

const stamp = Date.now().toString(36);
const updated = content.replace("BUILD_TIME", stamp);
writeFileSync(swPath, updated, "utf8");

console.log(`[stamp-sw] Cache version stamped: v1-${stamp}`);
