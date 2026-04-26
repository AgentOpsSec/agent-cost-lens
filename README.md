# Agent Cost Lens

**Know what every AI agent run actually costs.**

Agent Cost Lens tracks token usage, model usage, retries, latency, and estimated
cost across AI agents, CLI coding tools, API providers, and MCP-powered
workflows.

Think of it as:

```txt
Cost analytics for AI agent workflows
```

## Why This Exists

AI coding costs are often spread across multiple tools, providers, repositories,
models, retries, and failed runs. Developers and teams need visibility before
usage becomes hard to explain.

Agent Cost Lens answers questions like:

- How much did agent runs cost today?
- Which repo is the most expensive?
- Which model or provider is driving spend?
- How much cost came from retries?
- Which runs failed after spending tokens?
- Are prompts or tool loops causing waste?
- Which tasks should use a cheaper model?
- How should cost be exported for reporting?

Agent Cost Lens turns scattered agent usage into local cost reports.

## Install

```bash
npm install -g @agentopssec/agent-cost-lens
```

Or run it without installing:

```bash
npx -y @agentopssec/agent-cost-lens today
```

## Update

```bash
agent-cost update          # check the registry, prompt before installing
agent-cost update --yes    # update without prompting
```

## Primary Workflow

Agent Cost Lens starts with local summaries:

```bash
agent-cost today
```

The workflow should do three things well:

1. Collect cost and usage data from local agent runs.
2. Summarize spend by repo, model, provider, and time period.
3. Identify expensive runs and retry waste.

## CLI

```bash
agent-cost day
agent-cost today
agent-cost week
agent-cost month
agent-cost by-model
agent-cost by-provider
agent-cost by-repo
agent-cost expensive-runs
agent-cost export --csv
agent-cost budget set 50
agent-cost budget check --period month --ci
agent-cost pricing init
agent-cost explain run_001
agent-cost record --runId run_001 --inputTokens 1000 --outputTokens 500
agent-cost run -- codex "fix tests"
eval "$(agent-cost init-shell)"
agent-cost update [--yes]
```

## Using Existing Repos

Agent Cost Lens is local-first and repo-scoped. Run it from the repository you
want to measure:

```bash
cd ~/code/my-app
agent-cost month
```

That command reads local data from:

```txt
.agent-cost/records.jsonl
.agent-flight/runs/*.json
```

If those files do not exist yet, the report will be empty. Agent Cost Lens
cannot infer historical API spend from a git repo by itself; it needs either
recorded agent runs or manually added cost records.

There are three normal ways to populate data. Agent Flight Recorder is optional,
not required.

Wrap an agent command directly with Agent Cost Lens:

```bash
cd ~/code/my-app
agent-cost run --provider openai --model gpt-5.2 --inputTokens 18400 --outputTokens 2400 -- codex "fix the failing tests"
agent-cost month
```

Install shell shims so normal CLI commands are recorded:

```bash
eval "$(agent-cost init-shell)"
codex "fix the failing tests"
claude "review this repo"
gemini "write unit tests"
opencode "fix the failing tests"
agent-cost month
```

Add the `eval` line to your shell profile if you want this behavior in every
terminal session.

Record new work through Agent Flight Recorder:

```bash
cd ~/code/my-app
agent-flight run -- codex "fix the failing tests"
agent-cost month
```

Add a known cost record manually:

```bash
cd ~/code/my-app
agent-cost record --runId run_001 --agent codex --repo my-app --provider openai --model gpt-5.2 --inputTokens 18400 --outputTokens 2400
agent-cost month
```

You can also point at a repo without changing directories:

```bash
agent-cost month --cwd ~/code/my-app
agent-cost by-repo --cwd ~/code/my-app
```

For existing repos, the first run will usually show zero until you begin
recording new agent sessions or add known usage as records.

Agent Cost Lens is standalone. It does not require Agent Flight Recorder. In the
full AgentOpsSec stack, it can also import local Agent Flight Recorder and Agent
Sandbox run files as optional sources:

```txt
.agent-flight/runs/*.json
.agent-sandbox/runs/*.json
```

## What Agent Cost Lens Tracks

Agent Cost Lens records and summarizes:

- Cost per run
- Cost per repo
- Cost per pull request
- Cost per model
- Cost per provider
- Cost per developer when available
- Input tokens
- Output tokens
- Cache tokens
- Retry count
- Failed run cost
- Latency
- Tool-call overhead
- Expensive prompts
- Budget thresholds

## Example Summary

```txt
Agent Cost Lens Today by github.com/AgentOpsSec

Today:
- Total cost: $18.42
- Most expensive repo: dashboard-app
- Most expensive model: Claude Sonnet
- Highest waste: 34% retries
- Most expensive run: $2.14
- Recommended optimization: use a cheaper model for test generation
```

## Cost Record Shape

```json
{
  "tool": {
    "name": "Agent Cost Lens",
    "by": "github.com/AgentOpsSec",
    "repository": "github.com/AgentOpsSec/agent-cost-lens"
  },
  "runId": "run_001",
  "agent": "codex",
  "repo": "dashboard-app",
  "provider": "openai",
  "model": "gpt-5.2",
  "inputTokens": 18400,
  "outputTokens": 2400,
  "cacheTokens": 0,
  "toolCallCount": 12,
  "latencyMs": 252000,
  "retryCount": 2,
  "estimatedCost": 0.42,
  "timestamp": "2026-04-25T10:04:12Z",
  "taskLabel": "fix failing tests"
}
```

## Reports and Exports

Agent Cost Lens is designed to support:

- Daily summaries
- Weekly summaries
- Monthly summaries
- Provider reports
- Model reports
- Repo reports
- Expensive run detection
- Budget thresholds
- CSV export
- JSON export

## Budgets and Pricing

```bash
agent-cost pricing init
agent-cost budget set 50
agent-cost budget check --period month --ci
```

`pricing init` writes `.agent-cost/pricing.json` so teams can tune local
provider/model prices. `budget check` owns the CI decision for cost budgets and
exits nonzero with `--ci` when spend exceeds the configured budget.

## Design Principles

- Local-first
- Open-source
- No telemetry by default
- Transparent pricing config
- Useful estimates when exact usage is missing
- Clear budget reporting
- Exportable data
- Integration-friendly run records

## Initial Release Scope

The initial release includes local cost tracking, pricing configuration,
summaries by time period and dimension, expensive run detection, budgets, and
exports.

### 1.0: Local Cost Records

- Store local run cost records
- Import usage from recorded agent runs where available
- Estimate cost when exact usage is missing
- Track provider, model, repo, and timestamp
- Support a local provider pricing config
- Explain how a cost estimate was calculated

### 1.0: Summaries and Budgets

- Show today's total cost
- Show weekly and monthly summaries
- Break down cost by model
- Break down cost by provider
- Break down cost by repo
- Set and read budget thresholds
- Highlight failed run cost

### 1.0: Waste Detection and Export

- Detect expensive runs
- Track retry waste
- Identify token spikes
- Show high-latency runs
- Export reports as CSV
- Export reports as JSON
- Link costs back to run IDs for inspection


## Output

Reports use plain-language status words rather than raw exit codes:

- `ok` — the step ran successfully (green).
- `failed (exit N)` — the step exited non-zero (red); the original code is preserved.
- `skipped (reason)` — the step was not applicable (dim).

Severity colors follow the AgentOpsSec palette (safe = green, warning = amber, risk = red). The palette honors `NO_COLOR` and `FORCE_COLOR`, and JSON / CSV output stays plain.


- Repo: https://github.com/AgentOpsSec/agent-cost-lens
- npm: https://www.npmjs.com/package/@agentopssec/agent-cost-lens
- AgentOpsSec stack: https://github.com/AgentOpsSec/stack
- Website: https://AgentOpsSec.com

## Author

Created and developed by **Aunt Gladys Nephew**.

- Website: https://auntgladysnephew.com
- GitHub: https://github.com/auntgladysnephew
- X: https://x.com/AGNonX
