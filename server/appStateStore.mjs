import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const dbPath = resolve(process.cwd(), ".cache", "app-state.json");
const allowedKeys = new Set(["accounts", "strategies"]);

async function readDb() {
  try {
    const raw = await readFile(dbPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeDb(db) {
  await mkdir(dirname(dbPath), { recursive: true });
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
}

export function isAllowedStateKey(key) {
  return allowedKeys.has(key);
}

export async function readAppState(key) {
  const db = await readDb();
  return db[key] ?? null;
}

export async function writeAppState(key, value) {
  const db = await readDb();
  db[key] = value;
  db.updatedAt = new Date().toISOString();
  await writeDb(db);
  return db[key];
}
