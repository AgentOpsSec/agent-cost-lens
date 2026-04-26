import fs from "node:fs";
import path from "node:path";

export async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath) {
  try { return (await fs.promises.stat(filePath)).isFile(); } catch { return false; }
}

export async function readJson(filePath, fallback = undefined) {
  if (!(await fileExists(filePath))) {
    if (fallback !== undefined) return fallback;
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(await fs.promises.readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.promises.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function stringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parseArgs(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (!arg.startsWith("-")) {
      positional.push(arg);
      continue;
    }
    if (["--json", "--csv", "--ci", "--force", "--help", "-h"].includes(arg)) {
      const key = arg.replace(/^--?/, "");
      flags[key === "h" ? "help" : key] = true;
      continue;
    }
    const [key, inline] = arg.replace(/^--/, "").split("=", 2);
    const value = inline ?? args[i + 1];
    if (inline === undefined) {
      if (value === undefined || String(value).startsWith("-")) throw new Error(`--${key} requires a value.`);
      i += 1;
    }
    flags[key] = value;
  }
  return { flags, positional };
}

export function startOfPeriod(period, now = new Date()) {
  const date = new Date(now);
  if (period === "today") date.setHours(0, 0, 0, 0);
  if (period === "week") date.setDate(date.getDate() - 7);
  if (period === "month") date.setMonth(date.getMonth() - 1);
  return date;
}
