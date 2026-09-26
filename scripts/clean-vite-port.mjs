#!/usr/bin/env node
// Dev-only helper: frees the Vite dev-server port before a new dev session
// starts, so `npm run tauri dev` boots cleanly even if a stale Vite process
// from a previous session is still holding the port.
//
// Why this exists: `tauri dev` runs `beforeDevCommand` (`npm run dev`) as a
// process chain on Windows — cmd.exe -> node (npm-cli) -> cmd.exe -> node
// (vite). When the app window is closed, the Tauri CLI only terminates its
// direct child (the outer cmd.exe); killing that does NOT kill the detached
// grandchildren, so the vite `node` process keeps listening. Vite is configured
// with `strictPort: true`, so the next `tauri dev` run then refuses to bind and
// aborts.
//
// This script finds the stale listener on the dev port and kills its whole
// process tree. It only ever terminates processes whose command line
// identifies them as Vite, so it cannot touch unrelated programs, and it never
// runs outside the npm dev lifecycle — the application's functionality is
// unaffected.
//
// Overrides:
//   MSS_VITE_PORT            port to inspect (default 1420)
//   MSS_VITE_CLEAN_DRY_RUN   "1" prints what would be killed without killing

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const PORT = Number(process.env.MSS_VITE_PORT || 1420);
const DRY_RUN = process.env.MSS_VITE_CLEAN_DRY_RUN === "1";
const WINDOWS = process.platform === "win32";
// Match a Vite executable or CLI invocation — "vite" standing alone as a path
// segment or command token (vite, .bin/vite, node_modules/vite/bin/vite.js,
// vite.cmd, vite-7) — not any unrelated word/path merely containing the substring.
const IS_VITE = /(?:^|[\s/\\])vite(?:$|[\s/\\.]|-\d)/i;

function portOfLocalAddress(local) {
  const bracket = /^\[[^\]]+\]:(\d+)$/.exec(local);
  if (bracket) return Number(bracket[1]);
  return Number(local.split(":").pop());
}

function listenerPids() {
  const pids = new Set();
  if (WINDOWS) {
    const out = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/^TCP\s+(\S+)\s+(\S+)\s+LISTENING\s+(\d+)$/i);
      if (!m) continue;
      const pid = Number(m[3]);
      if (pid > 0 && portOfLocalAddress(m[1]) === PORT) pids.add(pid);
    }
  } else {
    try {
      const out = execFileSync("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN"], {
        encoding: "utf8",
      });
      for (const line of out.split(/\r?\n/).slice(1)) {
        const pid = Number(line.trim().split(/\s+/)[1]);
        if (Number.isFinite(pid) && pid > 0) pids.add(pid);
      }
    } catch {
      /* lsof unavailable: nothing detected */
    }
  }
  return [...pids];
}

function commandLineOf(pid) {
  if (WINDOWS) {
    try {
      return execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`,
        ],
        { encoding: "utf8" },
      ).trim();
    } catch {
      return "";
    }
  }
  if (existsSync(`/proc/${pid}/cmdline`)) {
    return readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " ").trim();
  }
  // macOS (and Linux without /proc): look the process up via `ps`.
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function killTree(pid) {
  if (WINDOWS) {
    const r = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      encoding: "utf8",
    });
    return r.status === 0;
  }
  try {
    process.kill(pid, "SIGKILL");
    return true;
  } catch {
    return false;
  }
}

const pids = listenerPids();
if (pids.length === 0) {
  console.log(`clean-vite-port: port ${PORT} is free`);
  process.exit(0);
}

let killed = 0;
let waiting = 0;
for (const pid of pids) {
  const cmd = commandLineOf(pid);
  if (!IS_VITE.test(cmd)) {
    console.warn(`clean-vite-port: NOT touching PID ${pid} on port ${PORT} (command line is not Vite: ${cmd.slice(0, 60)})`);
    continue;
  }
  waiting++;
  if (DRY_RUN) {
    console.log(`clean-vite-port: [dry run] would kill stale Vite PID ${pid} on port ${PORT}`);
    continue;
  }
  if (killTree(pid)) {
    console.log(`clean-vite-port: killed stale Vite PID ${pid} on port ${PORT}`);
    killed++;
  } else {
    console.warn(`clean-vite-port: FAILED to kill PID ${pid} on port ${PORT} — it may be running elevated`);
  }
}

process.exit(waiting === killed ? 0 : 1);