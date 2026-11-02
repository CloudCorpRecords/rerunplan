# rerunplan

A check failed. Rerun it, or fix it? rerunplan classifies the
failure from evidence — the failing check's name, its error
signature, and past runs of the same check — and answers with a
classification, a recommendation, and the evidence lines that
drove the call:

- `infra_flake` → **rerun** — the error signature matches a
  known infrastructure pattern (timeout, connection reset, DNS,
  rate limit, runner loss, gateway errors) and the check is not
  failing that way every time
- `flaky` → **rerun** — the check has passed before *and* has
  failed before with this same error signature; the failure
  comes and goes
- `real_failure` → **fix** — the check fails in every usable
  past run (with the current signature, when one is given); an
  infra-looking signature that fails *every* time is still a
  real failure
- `insufficient_evidence` → **investigate** — no usable history,
  or a mixed history no rule claims

Rules fire in a fixed order and each appends its evidence.
Statuses are normalised (`success`/`pass`/`passed`,
`failure`/`fail`/`failed`/`error`); runs for other checks are
ignored. Pure local computation: no network, no configuration.

## CLI

```bash
npx @reneturcios/rerunplan plan --check unit-tests --signature "Error: boom" --past past-runs.json
npx @reneturcios/rerunplan --version
```

`past-runs.json` is a JSON array of
`{"check": "unit-tests", "status": "failure", "error_signature": "Error: boom"}`
objects (`check` and `error_signature` optional per run).

Exit codes: `0` on success, `1` on a runtime error (including
an unreadable or invalid past-runs file), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/rerunplan mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "rerunplan": {
      "command": "npx",
      "args": ["-y", "@reneturcios/rerunplan", "mcp"]
    }
  }
}
```

### Tools

- `plan_rerun` — Classify a failed check from its past-run
  history and recommend rerun, fix, or investigate.
  - `check` (string, required) — the failed check's name
  - `error_signature` (string, optional) — the current
    failure's error signature
  - `past_runs` (array, required) — past runs as
    `{check?, status, error_signature?}` objects

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/rerunplan
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/rerunplan plan --check unit-tests --past /w/past-runs.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
