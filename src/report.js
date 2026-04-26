import { brandedTitle } from "./constants.js";
import { amber, dim, green, red } from "./tui.js";

export function renderSummary(summary, label) {
  const lines = [brandedTitle(label), ""];
  lines.push(`${capitalize(summary.period)}:`);
  lines.push(`- Total cost: $${summary.totalCost.toFixed(4)}`);
  lines.push(`- Runs: ${summary.runCount}`);
  const failedColor = summary.failedRunCost > 0 ? red : green;
  lines.push(`- Failed run cost: ${failedColor(`$${summary.failedRunCost.toFixed(4)}`)}`);
  const retryColor = summary.retryWastePercent > 20 ? red : summary.retryWastePercent > 5 ? amber : green;
  lines.push(`- Retry waste: ${retryColor(`${summary.retryWastePercent}%`)}`);
  if (summary.budget) {
    const remainingColor = summary.budgetRemaining < 0 ? red : summary.budgetRemaining < summary.budget.amount * 0.2 ? amber : green;
    lines.push(`- Budget remaining: ${remainingColor(`$${summary.budgetRemaining.toFixed(4)}`)}`);
  }
  if (summary.runCount === 0) {
    lines.push("");
    lines.push(dim("No cost records found for this period."));
    lines.push("Agent Cost Lens reads local data from:");
    for (const source of summary.dataSources || []) lines.push(`- ${source}`);
    lines.push("");
    lines.push("Add a record with:");
    lines.push("agent-cost record --runId run_001 --agent codex --repo app --provider openai --model gpt-5.2 --inputTokens 1000 --outputTokens 500");
  }
  if (summary.groups.length > 0) {
    lines.push("");
    lines.push("Breakdown:");
    for (const group of summary.groups) lines.push(`- ${group.key}: $${group.cost.toFixed(4)} (${group.runs} runs)`);
  }
  if (summary.expensiveRuns.length > 0) {
    lines.push("");
    lines.push(`Most expensive run: ${summary.expensiveRuns[0].runId} $${summary.expensiveRuns[0].estimatedCost.toFixed(4)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderExplain(record) {
  return [
    brandedTitle("Explain"),
    "",
    `Run: ${record.runId}`,
    `Cost: $${Number(record.estimatedCost || 0).toFixed(6)}`,
    `Model: ${record.provider}/${record.model}`,
    `Tokens: input=${record.inputTokens} output=${record.outputTokens} cache=${record.cacheTokens}`,
    `Retries: ${record.retryCount}`,
    `Latency: ${record.latencyMs}ms`
  ].join("\n") + "\n";
}

function capitalize(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
