# rerunplan — Build Report

MCP Rebuild 1000 (Tranche #101+ Batch 10). **Original build**
from the program's own packages-100 plan
(`~/workspace/packages-100/100-packages-plan.md`, cluster B
#18: "Rerun or fix? Classifies a failure as infra flake vs
real, with past-run evidence"), NOT a rebuild of an external
server. The tool surface is the program's defined spec,
recorded in `harness/fixtures/rerunplan-tools-original.json`
with its `_source` labelled "program spec". Local build only —
nothing pushed or published.

Identity: repo `rerunplan`, npm `@reneturcios/rerunplan`,
MCP name `io.github.CloudCorpRecords/rerunplan`, version
`0.1.0`, bin `rerunplan` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Rerun or fix?
  Classify a failed check from past-run evidence: infra flake,
  flaky, or real.", ≤100 chars; npm entry carries
  `version: 0.1.0`; OCI entry `ghcr.io/cloudcorprecords/rerunplan:0.1.0`
  carries **no** `version` field), `Dockerfile`
  (node:20-alpine two-stage, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/rerunplan"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright (c)
  2026 Rene Turcios), `README.md` (fresh text), `CHANGELOG.md`
  (single 0.1.0 entry, 2026-10-27)
- `src/index.ts`, `src/cli.ts` (`plan --check <name>
  [--signature <s>] --past <file>`, `mcp`, `--version`; exit 2
  usage / 1 runtime error, argument validation before any file
  is read), `src/mcp.ts`, `src/types.ts`, `src/rerunplan.ts`
  (core, `VERSION = "0.1.0"`)
- `test/rerunplan.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`

## Tools implemented (1)

- `plan_rerun` — `check` (string, required),
  `error_signature` (string, optional), `past_runs` (array of
  {check?, status, error_signature?}, required).

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with explicit
  inputSchema literals exactly matching the fixture, per the
  standing fleet rule; zod still validates every `tools/call`.
- Classification rules fire in a fixed documented order
  (no-history → intermittent-same-signature → infra-pattern
  with an every-time guard → consistent-failure → mixed), and
  every fired rule appends its evidence line to the result.
  The infra-pattern list is a named constant in the core.
  Statuses are normalised case-insensitively; runs for other
  checks and unrecognised statuses are excluded from the
  considered set.
- Pure local computation: no network, no configuration, and
  rerunplan never itself reruns anything — it classifies and
  recommends only.

## Verification (foreground, coordinator re-run)

- `tsc --noEmit` exit 0; `npm run build` exit 0 (`dist/cli.js`)
- `npm test`: **10 tests, 10 pass, 0 fail** — flaky (rule 2),
  infra_flake (rule 3), real_failure with and without a
  signature (rule 4), the every-time infra guard,
  insufficient_evidence for no history / other-check history /
  mixed history (rules 1 and 5), cross-check and unrecognised-
  status filtering, input validation errors
- `dist/cli.js --version` → `0.1.0`
- Parity: `harness/parity.py` vs
  `harness/fixtures/rerunplan-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (program-spec
  fixture)

## Lockfile status

`package-lock.json` generated clean via Route 3 (temp copy with
only `package.json`, offline `npm install --package-lock-only
--ignore-scripts --offline`), verified: parses, name
`@reneturcios/rerunplan`, **128 package entries**. Local
`node_modules` is a symlink to the sibling burnmeter tree;
gitignored.

## Gaps / honest notes

- Program-spec build: the classification rules are this
  program's definitions, recorded in the fixture's `_source`
  and the core header. The infra-pattern list is a heuristic
  substring set, versioned with the code — it will need tuning
  against real CI history, which this build does not fetch.
- Container build not exercised locally; the publish-container
  workflow smoke-tests the image at publish time.
