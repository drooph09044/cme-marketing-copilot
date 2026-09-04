import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const isWindows = process.platform === "win32";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const bundledNpm = resolve(scriptDir, "..", ".tools", "node-v22.22.2-win-x64", isWindows ? "npm.cmd" : "npm");

function run(command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });

  return child;
}

function runWindowsCommand(command, args) {
  return run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command, ...args]);
}

const backend = isWindows ? run("python", ["backend/app.py"]) : run("python3", ["backend/app.py"]);
const frontendCommand = existsSync(bundledNpm) ? bundledNpm : isWindows ? "npm.cmd" : "npm";
const frontend = isWindows ? runWindowsCommand(frontendCommand, ["run", "dev"]) : run(frontendCommand, ["run", "dev"]);

function shutdown() {
  backend.kill();
  frontend.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
