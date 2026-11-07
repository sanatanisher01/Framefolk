const { spawn } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const firebaseTools = process.env.FIREBASE_TOOLS_PATH || path.join(process.env.APPDATA || "", "npm/node_modules/firebase-tools");
const { AuthEmulator } = require(path.join(firebaseTools, "lib/emulator/auth/index.js"));
const java = process.env.JAVA_BINARY || "java";
const jar = process.env.FIRESTORE_EMULATOR_JAR || path.join(os.homedir(), ".cache/firebase/emulators/cloud-firestore-emulator-v1.22.0.jar");
const project = "demo-framefolk";
const authPort = 9198, firestorePort = 8188;
const auth = new AuthEmulator({ projectId: project, host: "127.0.0.1", port: authPort });
const env = { ...process.env, FIRESTORE_EMULATOR_HOST: `127.0.0.1:${firestorePort}`, FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${authPort}`, GCLOUD_PROJECT: project };
let firestore, web;
async function main() {
  const log = fs.openSync(path.join(__dirname, "../firestore-test.log"), "w");
  firestore = spawn(java, ["-jar", jar, "--host=127.0.0.1", `--port=${firestorePort}`, `--project_id=${project}`, `--rules=${path.resolve(__dirname, "../firestore.rules")}`], { env, windowsHide: true, stdio: ["ignore", log, log] });
  firestore.on("error", error => console.error(error));
  await auth.start();
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (firestore.exitCode !== null) throw new Error("Firestore emulator exited. See firestore-test.log.");
    try { await fetch(`http://127.0.0.1:${firestorePort}`, { signal: AbortSignal.timeout(1000) }); ready = true; break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Firestore emulator did not start. See firestore-test.log.");
  console.log("Local Auth and Firestore emulators are ready.");
  const tests = spawn(process.execPath, [path.join(__dirname, "test-integration.cjs")], { env, windowsHide: true, stdio: "inherit" });
  process.exitCode = await new Promise(resolve => tests.on("exit", code => resolve(code ?? 1)));
  if (process.exitCode === 0 && process.argv.includes("--serve")) {
    web = spawn(process.execPath, [path.resolve(__dirname, "../node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "-p", "3100"], {
      windowsHide: true, stdio: "inherit", env: { ...env, NODE_ENV: "development", NEXT_DIST_DIR: ".next-test",
        FIREBASE_SERVICE_ACCOUNT_JSON: "", FIREBASE_PROJECT_ID: project, NEXT_PUBLIC_FIREBASE_PROJECT_ID: project,
        NEXT_PUBLIC_FIREBASE_API_KEY: "fake-api-key", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "localhost", NEXT_PUBLIC_FIREBASE_APP_ID: "test-app",
        NEXT_PUBLIC_USE_FIREBASE_EMULATOR: "true", NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: env.FIREBASE_AUTH_EMULATOR_HOST,
        NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST: env.FIRESTORE_EMULATOR_HOST,
      },
    });
    console.log("Test site starting at http://127.0.0.1:3100. Stop through http://127.0.0.1:3199/stop.");
    await new Promise(resolve => {
      const control = require("node:http").createServer((request, response) => {
        if (request.url === "/stop") { response.end("Stopped"); control.close(); resolve(); }
        else { response.statusCode = 404; response.end(); }
      });
      control.listen(3199, "127.0.0.1");
    });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await auth.stop();
  if (web) web.kill();
  if (firestore) firestore.kill();
});
