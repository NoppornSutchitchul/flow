#!/usr/bin/env node
/**
 * Start backend + frontend and print URLs for desktop and phone (same Wi‑Fi).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { localLanIp } from "./localLanIp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = path.join(root, "backend");
const ip = localLanIp();
const port = process.env.VITE_PORT ?? "5173";

function printUrls() {
  console.log("\n── Flow dev ──────────────────────────────");
  console.log(`  Computer : http://localhost:${port}/`);
  if (ip) {
    console.log(`  Phone    : http://${ip}:${port}/  (same Wi‑Fi)`);
    console.log("  API/WS   : proxied through Vite — use the phone URL above");
  } else {
    console.log("  Phone    : (no LAN IP found — check Wi‑Fi)");
  }
  console.log("──────────────────────────────────────────\n");
}

printUrls();

const backend = spawn("./run.sh", [], {
  cwd: backendDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});

const frontend = spawn("npm", ["run", "dev"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, VITE_DEV_LAN_IP: ip ?? "" },
});

function shutdown(code = 0) {
  backend.kill("SIGTERM");
  frontend.kill("SIGTERM");
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

backend.on("exit", (code) => {
  if (code != null && code !== 0) shutdown(code);
});
frontend.on("exit", (code) => {
  if (code != null && code !== 0) shutdown(code);
});
