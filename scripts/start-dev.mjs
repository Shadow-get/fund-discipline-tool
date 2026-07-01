import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { resolve } from "node:path";

const cwd = resolve(import.meta.dirname, "..");
const viteBin = resolve(cwd, "node_modules", "vite", "bin", "vite.js");
const out = openSync(resolve(cwd, "vite-dev.log"), "a");
const err = openSync(resolve(cwd, "vite-dev.err.log"), "a");
const env = { ...process.env };
const pathValue = env.Path || env.PATH || "";

for (const key of Object.keys(env)) {
  if (key.toLowerCase() === "path") {
    delete env[key];
  }
}

env.Path = pathValue;

const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", "5173", "--strictPort"], {
  cwd,
  detached: true,
  env,
  stdio: ["ignore", out, err],
  windowsHide: true,
});

child.unref();
console.log(`Vite dev server started with pid ${child.pid}`);
