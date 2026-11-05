/**
 * Stamps the service worker with a unique build timestamp.
 * Replaces BUILD_TIME placeholder so every deploy busts all caches automatically.
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = join(__dirname, "..", "public", "sw.js");

const stamp = Date.now().toString(36); // e.g. "lz4k8q"
const content = readFileSync(swPath, "utf8");
const updated = content.replace("BUILD_TIME", stamp);
writeFileSync(swPath, updated, "utf8");

console.log(`[stamp-sw] Cache version stamped: v1-${stamp}`);
