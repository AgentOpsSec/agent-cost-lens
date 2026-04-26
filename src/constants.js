export const BRAND = "github.com/AgentOpsSec";
export const VERSION = "1.0.0";
export const TOOL = {
  name: "Agent Cost Lens",
  by: BRAND,
  repository: "github.com/AgentOpsSec/agent-cost-lens"
};
export const STATE_DIR = ".agent-cost";
export const RECORDS_FILE = ".agent-cost/records.jsonl";
export const BUDGET_FILE = ".agent-cost/budget.json";
export const PRICING_FILE = ".agent-cost/pricing.json";

export function brandedTitle(label = "") {
  return ["Agent Cost Lens", label, `by ${BRAND}`].filter(Boolean).join(" ");
}

export const DEFAULT_PRICING = {
  openai: {
    "gpt-5.2": { inputPerMillion: 1.25, outputPerMillion: 10 },
    codex: { inputPerMillion: 1.25, outputPerMillion: 10 },
    unknown: { inputPerMillion: 1, outputPerMillion: 5 }
  },
  anthropic: {
    claude: { inputPerMillion: 3, outputPerMillion: 15 },
    unknown: { inputPerMillion: 3, outputPerMillion: 15 }
  },
  google: {
    gemini: { inputPerMillion: 1.25, outputPerMillion: 5 },
    unknown: { inputPerMillion: 1, outputPerMillion: 5 }
  }
};

export const MODEL_ALIASES = {
  codex: { provider: "openai", model: "codex" },
  opencode: { provider: "openai", model: "codex" },
  claude: { provider: "anthropic", model: "claude" },
  gemini: { provider: "google", model: "gemini" }
};
