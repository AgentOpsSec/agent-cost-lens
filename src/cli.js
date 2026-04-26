import path from "node:path";
import { spawn } from "node:child_process";
import { brandedTitle, TOOL, VERSION } from "./constants.js";
import { normalizeRecord, summarize, toCsv } from "./cost.js";
import { renderExplain, renderSummary } from "./report.js";
import { appendRecord, initPricing, loadBudget, loadPricing, loadRecords, setBudget } from "./store.js";
import { amber, green, paint, red, setColor, shouldColor } from "./tui.js";
import { updateOne } from "./updater.js";
import { parseArgs, stringify } from "./utils.js";

const PACKAGE_NAME = "@agentopssec/agent-cost-lens";

async function runUpdate(args, io) {
  const flagSet = new Set(args);
  await updateOne({
    packageName: PACKAGE_NAME,
    currentVersion: VERSION,
    title: brandedTitle("Update"),
    color: { amber, green },
    io,
    yes: flagSet.has("--yes") || flagSet.has("-y")
  });
}

export async function main(argv = process.argv.slice(2), io = defaultIo()) {
  const command = argv[0] || "help";
  const args = argv.slice(1);
  if (["help", "--help", "-h"].includes(command)) return io.stdout(help());
  if (["version", "--version", "-v"].includes(command)) return io.stdout(`agent-cost ${VERSION}\n`);
  if (["day", "today", "week", "month"].includes(command)) return runSummary(command === "day" ? "today" : command, args, io);
  if (command === "by-model") return runSummary("month", ["--group", "model", ...args], io);
  if (command === "by-provider") return runSummary("month", ["--group", "provider", ...args], io);
  if (command === "by-repo") return runSummary("month", ["--group", "repo", ...args], io);
  if (command === "expensive-runs") return runSummary("month", ["--group", "runId", ...args], io);
  if (command === "export") return runExport(args, io);
  if (command === "budget") return runBudget(args, io);
  if (command === "pricing") return runPricing(args, io);
  if (command === "explain") return runExplain(args, io);
  if (command === "record") return runRecord(args, io);
  if (command === "run") return runCommand(args, io);
  if (command === "init-shell") return runInitShell(args, io);
  if (command === "update" || command === "--update") return runUpdate(args, io);
  throw new Error(`Unknown command "${command}".`);
}

async function records(cwd) {
  const pricing = await loadPricing(cwd);
  return (await loadRecords(cwd)).map((record) => normalizeRecord(record, pricing));
}

async function runSummary(period, args, io) {
  const { flags } = parseArgs(args);
  const cwd = flags.cwd ? path.resolve(flags.cwd) : process.cwd();
  const summary = summarize(await records(cwd), {
    period,
    groupBy: flags.group || null,
    budget: await loadBudget(cwd),
    dataSources: [
      path.join(cwd, ".agent-cost", "records.jsonl"),
      path.join(cwd, ".agent-flight", "runs"),
      path.join(cwd, ".agent-sandbox", "runs")
    ]
  });
  io.stdout(flags.json ? stringify(summary) : renderSummary(summary, labelFor(period, flags.group)));
}

async function runExport(args, io) {
  const { flags } = parseArgs(args);
  const cwd = flags.cwd ? path.resolve(flags.cwd) : process.cwd();
  const data = await records(cwd);
  io.stdout(flags.csv ? toCsv(data) : stringify({ tool: TOOL, records: data }));
}

async function runBudget(args, io) {
  const { flags, positional } = parseArgs(args);
  const cwd = flags.cwd ? path.resolve(flags.cwd) : process.cwd();
  if (positional[0] === "set") {
    const budget = await setBudget(positional[1], cwd);
    return io.stdout(flags.json ? stringify({ tool: TOOL, budget }) : `${brandedTitle("Budget")}\n\nBudget set: $${budget.amount}\n`);
  }
  if (positional[0] === "check") {
    const period = flags.period || "month";
    const summary = summarize(await records(cwd), {
      period,
      budget: await loadBudget(cwd),
      dataSources: [
        path.join(cwd, ".agent-cost", "records.jsonl"),
        path.join(cwd, ".agent-flight", "runs"),
        path.join(cwd, ".agent-sandbox", "runs")
      ]
    });
    const passed = !summary.budget || summary.budgetRemaining >= 0;
    const result = { tool: TOOL, passed, period, summary };
    const verdict = passed ? green("passed") : red("failed");
    const remaining = summary.budget ? (summary.budgetRemaining < 0 ? red(`$${summary.budgetRemaining.toFixed(4)}`) : green(`$${summary.budgetRemaining.toFixed(4)}`)) : "n/a";
    io.stdout(flags.json ? stringify(result) : `${brandedTitle("Budget Check")}\n\nPeriod: ${period}\nBudget: ${summary.budget ? `$${summary.budget.amount}` : "not set"}\nTotal cost: $${summary.totalCost.toFixed(4)}\nRemaining: ${remaining}\nResult: ${verdict}\n`);
    if (flags.ci && !passed) io.setExitCode(1);
    return;
  }
  const budget = await loadBudget(cwd);
  io.stdout(flags.json ? stringify({ tool: TOOL, budget }) : `${brandedTitle("Budget")}\n\nBudget: ${budget ? `$${budget.amount}` : "not set"}\n`);
}

async function runPricing(args, io) {
  const { flags, positional } = parseArgs(args);
  const cwd = flags.cwd ? path.resolve(flags.cwd) : process.cwd();
  if (positional[0] === "init") {
    const result = await initPricing(cwd, { force: Boolean(flags.force) });
    return io.stdout(flags.json ? stringify({ tool: TOOL, ...result }) : `${brandedTitle("Pricing")}\n\n${result.created ? "Created" : "Already exists"}: ${result.filePath}\n`);
  }
  const pricing = await loadPricing(cwd);
  io.stdout(flags.json ? stringify({ tool: TOOL, pricing }) : `${brandedTitle("Pricing")}\n\n${JSON.stringify(pricing, null, 2)}\n`);
}

async function runExplain(args, io) {
  const { flags, positional } = parseArgs(args);
  const cwd = flags.cwd ? path.resolve(flags.cwd) : process.cwd();
  const runId = positional[0];
  const record = (await records(cwd)).find((item) => item.runId === runId);
  if (!record) throw new Error(`Run not found: ${runId}`);
  io.stdout(flags.json ? stringify(record) : renderExplain(record));
}

async function runRecord(args, io) {
  const { flags } = parseArgs(args);
  const cwd = flags.cwd ? path.resolve(flags.cwd) : process.cwd();
  const record = normalizeRecord({
    runId: flags.runId,
    agent: flags.agent,
    repo: flags.repo,
    provider: flags.provider,
    model: flags.model,
    inputTokens: Number(flags.inputTokens || 0),
    outputTokens: Number(flags.outputTokens || 0),
    retryCount: Number(flags.retryCount || 0),
    estimatedCost: flags.estimatedCost === undefined ? undefined : Number(flags.estimatedCost),
    timestamp: flags.timestamp || new Date().toISOString(),
    taskLabel: flags.taskLabel,
    status: flags.status || "success"
  }, await loadPricing(cwd));
  await appendRecord(record, cwd);
  io.stdout(flags.json ? stringify(record) : `${brandedTitle("Record")}\n\nRecorded ${record.runId}\n`);
}

async function runCommand(args, io) {
  const { flags, positional } = parseArgs(args);
  const cwd = flags.cwd ? path.resolve(flags.cwd) : process.cwd();
  if (positional.length === 0) {
    throw new Error("run requires a command after --, for example: agent-cost run -- codex \"fix tests\"");
  }

  const startedAt = new Date().toISOString();
  const started = Date.now();
  const exitCode = await spawnCommand(positional[0], positional.slice(1), cwd, io);
  const endedAt = new Date().toISOString();
  const commandLine = positional.join(" ");
  const record = normalizeRecord({
    runId: flags.runId || `run_${Date.now()}`,
    agent: flags.agent || positional[0],
    repo: flags.repo || path.basename(cwd),
    provider: flags.provider,
    model: flags.model,
    inputTokens: Number(flags.inputTokens || 0),
    outputTokens: Number(flags.outputTokens || 0),
    cacheTokens: Number(flags.cacheTokens || 0),
    toolCallCount: Number(flags.toolCallCount || 0),
    latencyMs: Date.now() - started,
    retryCount: Number(flags.retryCount || 0),
    estimatedCost: flags.estimatedCost === undefined ? undefined : Number(flags.estimatedCost),
    timestamp: endedAt,
    taskLabel: flags.taskLabel || commandLine,
    status: exitCode === 0 ? "success" : "failed",
    startedAt,
    endedAt,
    command: positional
  }, await loadPricing(cwd));

  await appendRecord(record, cwd);

  if (flags.json) {
    io.stdout(stringify(record));
  } else {
    const status = exitCode === 0 ? green(`ok (exit ${exitCode})`) : red(`failed (exit ${exitCode})`);
    io.stdout([
      brandedTitle("Run"),
      "",
      `Command: ${commandLine}`,
      `Result: ${status}`,
      `Recorded: ${record.runId}`,
      `Estimated cost: $${record.estimatedCost.toFixed(6)}`,
      `Latency: ${record.latencyMs}ms`
    ].join("\n") + "\n");
  }

  io.setExitCode?.(exitCode);
}

function spawnCommand(command, args, cwd, io) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["inherit", "pipe", "pipe"] });
    child.stdout?.on("data", (chunk) => io.stdout?.(chunk.toString()));
    child.stderr?.on("data", (chunk) => io.stderr?.(chunk.toString()));
    child.on("error", (error) => {
      io.stderr?.(`${error.message}\n`);
      resolve(1);
    });
    child.on("close", (code) => resolve(code || 0));
  });
}

function runInitShell(args, io) {
  const { flags } = parseArgs(args);
  const provider = flags.provider ? ` --provider ${shellQuote(flags.provider)}` : "";
  const model = flags.model ? ` --model ${shellQuote(flags.model)}` : "";
  io.stdout([
    "# Agent Cost Lens shell integration by github.com/AgentOpsSec",
    "# Add this to your shell with:",
    "# eval \"$(agent-cost init-shell)\"",
    "",
    "codex() {",
    `  command agent-cost run --agent codex${provider}${model} -- codex "$@"`,
    "}",
    "",
    "claude() {",
    `  command agent-cost run --agent claude${provider}${model} -- claude "$@"`,
    "}",
    "",
    "gemini() {",
    `  command agent-cost run --agent gemini${provider}${model} -- gemini "$@"`,
    "}",
    "",
    "opencode() {",
    `  command agent-cost run --agent opencode${provider}${model} -- opencode "$@"`,
    "}"
  ].join("\n") + "\n");
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function labelFor(period, group) {
  if (group === "model") return "By Model";
  if (group === "provider") return "By Provider";
  if (group === "repo") return "By Repo";
  if (group === "runId") return "Expensive Runs";
  return period === "today" ? "Today" : period === "week" ? "Week" : "Month";
}

function help() {
  return [
    brandedTitle(),
    "",
    "Usage:",
    "  agent-cost day",
    "  agent-cost today",
    "  agent-cost week",
    "  agent-cost month",
    "  agent-cost by-model",
    "  agent-cost by-provider",
    "  agent-cost by-repo",
    "  agent-cost expensive-runs",
    "  agent-cost export --csv",
    "  agent-cost budget set 50",
    "  agent-cost budget check --period month --ci",
    "  agent-cost pricing init",
    "  agent-cost explain run_001",
    "  agent-cost record --runId run_001 --inputTokens 1000 --outputTokens 500",
    "  agent-cost run -- codex \"fix tests\"",
    "  eval \"$(agent-cost init-shell)\"",
    "  agent-cost update [--yes]"
  ].join("\n") + "\n";
}

function defaultIo() {
  setColor(shouldColor(process.stdout));
  return {
    stdout: (text) => process.stdout.write(paint(text)),
    stderr: (text) => process.stderr.write(paint(text)),
    setExitCode: (code) => { process.exitCode = code; }
  };
}
