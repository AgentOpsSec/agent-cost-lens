import fs from "node:fs";
import path from "node:path";
import { BUDGET_FILE, DEFAULT_PRICING, PRICING_FILE, RECORDS_FILE, TOOL } from "./constants.js";
import { ensureDir, fileExists, readJson, writeJson } from "./utils.js";

export async function appendRecord(record, cwd = process.cwd()) {
  const filePath = path.join(cwd, RECORDS_FILE);
  await ensureDir(path.dirname(filePath));
  await fs.promises.appendFile(filePath, `${JSON.stringify({ schemaVersion: "1.0", tool: TOOL, ...record })}\n`, "utf8");
}

export async function loadRecords(cwd = process.cwd()) {
  const filePath = path.join(cwd, RECORDS_FILE);
  const records = [];
  if (await fileExists(filePath)) {
    const raw = await fs.promises.readFile(filePath, "utf8");
    records.push(...parseJsonLines(raw));
  }
  records.push(...await importFlightRuns(cwd));
  records.push(...await importSandboxRuns(cwd));
  return dedupe(records);
}

export async function loadPricing(cwd = process.cwd()) {
  return readJson(path.join(cwd, PRICING_FILE), DEFAULT_PRICING);
}

export async function initPricing(cwd = process.cwd(), { force = false } = {}) {
  const filePath = path.join(cwd, PRICING_FILE);
  if (!force && await fileExists(filePath)) return { filePath, created: false };
  await writeJson(filePath, DEFAULT_PRICING);
  return { filePath, created: true };
}

export async function setBudget(amount, cwd = process.cwd()) {
  const number = Number(amount);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error("budget amount must be a non-negative number.");
  }
  const budget = { amount: number, setAt: new Date().toISOString() };
  await writeJson(path.join(cwd, BUDGET_FILE), budget);
  return budget;
}

export async function loadBudget(cwd = process.cwd()) {
  return readJson(path.join(cwd, BUDGET_FILE), null);
}

async function importFlightRuns(cwd) {
  const runsDir = path.join(cwd, ".agent-flight", "runs");
  const files = await fs.promises.readdir(runsDir).catch(() => []);
  const records = [];
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const run = await readJson(path.join(runsDir, file)).catch(() => null);
    if (!run) continue;
    records.push({
      tool: TOOL,
      runId: run.runId,
      agent: run.agent,
      repo: path.basename(run.projectPath || cwd),
      provider: run.provider || "unknown",
      model: run.model || "unknown",
      inputTokens: Number(run.inputTokens || 0),
      outputTokens: Number(run.outputTokens || 0),
      cacheTokens: Number(run.cacheTokens || 0),
      toolCallCount: run.events?.filter((event) => event.type?.includes("tool")).length || 0,
      latencyMs: run.durationMs || 0,
      retryCount: Number(run.retryCount || 0),
      estimatedCost: Number(run.estimatedCost || 0),
      timestamp: run.endedAt || run.startedAt || new Date().toISOString(),
      taskLabel: run.prompt || run.command?.join(" ") || "agent run",
      status: run.exitCode === 0 ? "success" : "failed"
    });
  }
  return records;
}

async function importSandboxRuns(cwd) {
  const runsDir = path.join(cwd, ".agent-sandbox", "runs");
  const files = await fs.promises.readdir(runsDir).catch(() => []);
  const records = [];
  for (const file of files.filter((name) => /^run_\d+\.json$/.test(name))) {
    const run = await readJson(path.join(runsDir, file)).catch(() => null);
    if (!run) continue;
    records.push({
      tool: TOOL,
      runId: `sandbox_${run.runId}`,
      agent: run.command?.[0] || "unknown",
      repo: path.basename(run.originalProjectPath || cwd),
      provider: "unknown",
      model: "unknown",
      inputTokens: 0,
      outputTokens: 0,
      cacheTokens: 0,
      toolCallCount: 0,
      latencyMs: run.durationMs || 0,
      retryCount: 0,
      estimatedCost: 0,
      timestamp: run.endedAt || run.startedAt || new Date().toISOString(),
      taskLabel: run.command?.join(" ") || "agent sandbox run",
      status: run.exitCode === 0 ? "success" : "failed",
      source: "agent-sandbox"
    });
  }
  return records;
}

function parseJsonLines(raw) {
  const records = [];
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    try {
      records.push(JSON.parse(line));
    } catch {
      // Ignore corrupt local records so one bad append does not break summaries.
    }
  }
  return records;
}

function dedupe(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = `${record.runId || ""}:${record.timestamp || ""}:${record.estimatedCost || 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
