import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { main } from "../src/cli.js";

function io() {
  let output = "";
  let exitCode = 0;
  return {
    api: {
      stdout: (text) => { output += text; },
      stderr: (text) => { output += text; },
      setExitCode: (code) => { exitCode = code; }
    },
    get output() { return output; },
    get exitCode() { return exitCode; }
  };
}

test("records and summarizes costs", async () => {
  const cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), "agent-cost-"));
  let session = io();
  await main(["record", "--cwd", cwd, "--runId", "run_001", "--agent", "codex", "--repo", "app", "--provider", "openai", "--model", "gpt-5.2", "--inputTokens", "1000", "--outputTokens", "500", "--retryCount", "1"], session.api);
  assert.match(session.output, /Agent Cost Lens Record by github\.com\/AgentOpsSec/);

  session = io();
  await main(["today", "--cwd", cwd], session.api);
  assert.match(session.output, /Agent Cost Lens Today by github\.com\/AgentOpsSec/);
  assert.match(session.output, /Total cost/);

  session = io();
  await main(["explain", "run_001", "--cwd", cwd], session.api);
  assert.match(session.output, /Agent Cost Lens Explain by github\.com\/AgentOpsSec/);
});

test("budget and CSV export work", async () => {
  const cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), "agent-cost-budget-"));
  let session = io();
  await main(["budget", "set", "50", "--cwd", cwd], session.api);
  assert.match(session.output, /Budget set/);
  session = io();
  await main(["budget", "check", "--cwd", cwd, "--ci"], session.api);
  assert.match(session.output, /Budget Check/);
  assert.equal(session.exitCode, 0);
  session = io();
  await main(["export", "--csv", "--cwd", cwd], session.api);
  assert.match(session.output, /runId,agent,repo/);
});

test("rejects invalid cost inputs and skips corrupt local records", async () => {
  const cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), "agent-cost-invalid-"));
  await assert.rejects(() => main(["budget", "set", "nope", "--cwd", cwd], io().api), /budget amount/);
  await assert.rejects(() => main(["record", "--cwd", cwd, "--runId", "bad", "--estimatedCost=-1"], io().api), /estimatedCost/);

  await fs.promises.mkdir(path.join(cwd, ".agent-cost"), { recursive: true });
  await fs.promises.writeFile(path.join(cwd, ".agent-cost", "records.jsonl"), "{\"runId\":\"ok\",\"estimatedCost\":0}\nnot-json\n", "utf8");
  const session = io();
  await main(["month", "--cwd", cwd], session.api);
  assert.match(session.output, /Runs: 1/);
});

test("budget check fails in CI and pricing init writes config", async () => {
  const cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), "agent-cost-budget-fail-"));
  let session = io();
  await main(["pricing", "init", "--cwd", cwd], session.api);
  assert.match(session.output, /Agent Cost Lens Pricing/);

  session = io();
  await main(["budget", "set", "0.01", "--cwd", cwd], session.api);
  session = io();
  await main(["record", "--cwd", cwd, "--runId", "run_001", "--agent", "codex", "--estimatedCost", "1"], session.api);
  session = io();
  await main(["budget", "check", "--cwd", cwd, "--ci"], session.api);
  assert.match(session.output, /Result: failed/);
  assert.equal(session.exitCode, 1);
});

test("empty summaries explain where data comes from and day aliases today", async () => {
  const cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), "agent-cost-empty-"));
  const session = io();
  await main(["day", "--cwd", cwd], session.api);
  assert.match(session.output, /Agent Cost Lens Today by github\.com\/AgentOpsSec/);
  assert.match(session.output, /No cost records found/);
  assert.match(session.output, /\.agent-cost\/records\.jsonl/);
  assert.match(session.output, /\.agent-flight\/runs/);
  assert.match(session.output, /\.agent-sandbox\/runs/);
});

test("run records command execution without Agent Flight Recorder", async () => {
  const cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), "agent-cost-run-"));
  let session = io();
  await main(["run", "--cwd", cwd, "--runId", "standalone_001", "--provider", "openai", "--model", "gpt-5.2", "--inputTokens", "1000", "--outputTokens", "500", "--", process.execPath, "-e", "console.log('ok')"], session.api);
  assert.match(session.output, /Agent Cost Lens Run by github\.com\/AgentOpsSec/);
  assert.match(session.output, /Recorded: standalone_001/);
  assert.equal(session.exitCode, 0);

  session = io();
  await main(["month", "--cwd", cwd], session.api);
  assert.match(session.output, /Runs: 1/);
});

test("init-shell emits normal CLI shims", async () => {
  const session = io();
  await main(["init-shell", "--provider", "openai", "--model", "gpt-5.2"], session.api);
  assert.match(session.output, /Agent Cost Lens shell integration by github\.com\/AgentOpsSec/);
  assert.match(session.output, /codex\(\)/);
  assert.match(session.output, /agent-cost run --agent codex --provider 'openai' --model 'gpt-5.2' -- codex/);
  assert.match(session.output, /claude\(\)/);
  assert.match(session.output, /gemini\(\)/);
  assert.match(session.output, /opencode\(\)/);
  assert.match(session.output, /agent-cost run --agent opencode --provider 'openai' --model 'gpt-5.2' -- opencode/);
});

test("summaries can import Agent Sandbox runs without requiring Sandbox code", async () => {
  const cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), "agent-cost-sandbox-"));
  const runsDir = path.join(cwd, ".agent-sandbox", "runs");
  await fs.promises.mkdir(runsDir, { recursive: true });
  await fs.promises.writeFile(path.join(runsDir, "run_001.json"), JSON.stringify({
    runId: "run_001",
    command: ["codex", "fix tests"],
    originalProjectPath: cwd,
    durationMs: 1234,
    exitCode: 0,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString()
  }), "utf8");
  const session = io();
  await main(["month", "--cwd", cwd], session.api);
  assert.match(session.output, /Runs: 1/);
});
