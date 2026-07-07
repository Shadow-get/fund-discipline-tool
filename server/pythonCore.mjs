import { spawn } from "node:child_process";
import { delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const pycorePath = fileURLToPath(new URL("../pycore", import.meta.url));

export function runPythonCore(action, payload = {}, { timeoutMs = 10000 } = {}) {
  const pythonCommand = process.env.PYTHON || process.env.PYTHON_EXECUTABLE || "python";
  const request = JSON.stringify({ action, payload });

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand, ["-m", "licai_core.cli"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONPATH: process.env.PYTHONPATH ? `${pycorePath}${delimiter}${process.env.PYTHONPATH}` : pycorePath,
        PYTHONIOENCODING: "utf-8",
      },
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill();
      reject(new Error(`Python core timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr || `Python core exited with code ${code}`));
        return;
      }

      try {
        const response = JSON.parse(stdout);
        if (!response.ok) {
          reject(new Error(response.error || "Python core failed"));
          return;
        }
        resolve(response.data);
      } catch (error) {
        reject(new Error(`Python core returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

    child.stdin.end(request, "utf8");
  });
}
