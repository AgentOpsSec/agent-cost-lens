# Changelog

All notable changes to this project are documented in this file.
This project follows [Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

## [1.0.0] - 2026-04-26

- Initial public release of Agent Cost Lens.
- Commands: `day/today/week/month`, `by-model`, `by-provider`, `by-repo`, `expensive-runs`, `export`, `budget`, `pricing`, `explain`, `record`, `run`, `init-shell`, `update`.
- Local pricing config, retry-waste metric, expensive-runs detection, and CSV/JSON export.
- Optional shell shims via `agent-cost init-shell` for transparent recording.
- Imports Agent Flight Recorder and Agent Sandbox runs without depending on either tool.
- `agent-cost run` summary uses plain-language results (`ok (exit N)`, `failed (exit N)`) instead of bare numeric exit codes.
