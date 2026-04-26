import { MODEL_ALIASES, TOOL } from "./constants.js";
import { startOfPeriod } from "./utils.js";

export function normalizeRecord(record, pricing) {
  const alias = MODEL_ALIASES[String(record.model || record.agent || "").toLowerCase()] || {};
  const provider = record.provider || alias.provider || "unknown";
  const model = record.model || alias.model || "unknown";
  const price = pricing[provider]?.[model] || pricing[provider]?.unknown || pricing.openai?.unknown || { inputPerMillion: 0, outputPerMillion: 0 };
  const inputTokens = nonNegativeNumber(record.inputTokens, "inputTokens");
  const outputTokens = nonNegativeNumber(record.outputTokens, "outputTokens");
  const estimatedCost = record.estimatedCost === undefined
    ? Number(((inputTokens / 1_000_000) * price.inputPerMillion + (outputTokens / 1_000_000) * price.outputPerMillion).toFixed(6))
    : nonNegativeNumber(record.estimatedCost, "estimatedCost");
  return {
    schemaVersion: "1.0",
    tool: TOOL,
    runId: record.runId || `run_${Math.random().toString(16).slice(2, 8)}`,
    agent: record.agent || "unknown",
    repo: record.repo || "unknown",
    provider,
    model,
    inputTokens,
    outputTokens,
    cacheTokens: nonNegativeNumber(record.cacheTokens, "cacheTokens"),
    toolCallCount: nonNegativeNumber(record.toolCallCount, "toolCallCount"),
    latencyMs: nonNegativeNumber(record.latencyMs, "latencyMs"),
    retryCount: nonNegativeNumber(record.retryCount, "retryCount"),
    estimatedCost,
    timestamp: record.timestamp || new Date().toISOString(),
    taskLabel: record.taskLabel || "",
    status: record.status || "unknown",
    command: record.command || undefined,
    startedAt: record.startedAt || undefined,
    endedAt: record.endedAt || undefined
  };
}

export function summarize(records, { period = "today", groupBy = null, budget = null, dataSources = [] } = {}) {
  const cutoff = startOfPeriod(period);
  const scoped = records.filter((record) => new Date(record.timestamp) >= cutoff);
  const totalCost = round(scoped.reduce((sum, record) => sum + Number(record.estimatedCost || 0), 0));
  const retryCost = round(scoped.reduce((sum, record) => sum + Number(record.estimatedCost || 0) * Math.min(record.retryCount || 0, 1), 0));
  const groups = groupBy ? group(scoped, groupBy) : [];
  return {
    tool: TOOL,
    period,
    totalCost,
    runCount: scoped.length,
    failedRunCost: round(scoped.filter((record) => record.status === "failed").reduce((sum, record) => sum + record.estimatedCost, 0)),
    retryWastePercent: totalCost === 0 ? 0 : Math.round((retryCost / totalCost) * 100),
    budget,
    budgetRemaining: budget ? round(budget.amount - totalCost) : null,
    dataSources,
    groups,
    expensiveRuns: [...scoped].sort((a, b) => b.estimatedCost - a.estimatedCost).slice(0, 10)
  };
}

export function toCsv(records) {
  const fields = ["runId", "agent", "repo", "provider", "model", "inputTokens", "outputTokens", "retryCount", "estimatedCost", "timestamp", "taskLabel", "status"];
  return [
    fields.join(","),
    ...records.map((record) => fields.map((field) => csv(record[field])).join(","))
  ].join("\n") + "\n";
}

function group(records, field) {
  const map = new Map();
  for (const record of records) {
    const key = record[field] || "unknown";
    const current = map.get(key) || { key, cost: 0, runs: 0 };
    current.cost += record.estimatedCost;
    current.runs += 1;
    map.set(key, current);
  }
  return [...map.values()].map((value) => ({ ...value, cost: round(value.cost) })).sort((a, b) => b.cost - a.cost);
}

function round(value) {
  return Number(value.toFixed(6));
}

function nonNegativeNumber(value, field) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${field} must be a non-negative number.`);
  }
  return number;
}

function csv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}
