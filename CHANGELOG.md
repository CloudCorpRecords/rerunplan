# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `plan_rerun` MCP tool and `plan` CLI command
  classifying a failed check from its past-run history.
- Classifications: `infra_flake`, `flaky`, `real_failure`,
  `insufficient_evidence`; recommendations: `rerun`, `fix`,
  `investigate` — each with the evidence lines that drove the
  call.
