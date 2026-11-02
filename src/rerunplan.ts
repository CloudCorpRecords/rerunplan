/**
 * rerunplan core: rerun-or-fix classification for a failed
 * check, from past-run evidence.
 *
 *   planRerun(check, errorSignature, pastRuns) -> result
 *
 * Rules, applied in order (first match wins; every fired rule
 * appends its evidence line):
 *
 * 1. No usable past runs for this check
 *      -> insufficient_evidence / investigate.
 * 2. The check has passed before AND has failed before with the
 *    current error signature
 *      -> flaky / rerun (the same failure comes and goes).
 * 3. The current error signature matches a known infrastructure
 *    pattern (timeout, connection reset, DNS, rate limit, runner
 *    loss, gateway errors, ...) and the check is not failing
 *    with that signature every time
 *      -> infra_flake / rerun.
 * 4. Every considered past run failed, and (when a signature is
 *    given) all failures carry the current signature
 *      -> real_failure / fix.
 * 5. Anything else (mixed history that matches no rule above)
 *      -> insufficient_evidence / investigate.
 *
 * Statuses are normalised case-insensitively: success / pass /
 * passed are passes; failure / fail / failed / error are
 * failures; anything else is not a usable run. Past runs naming
 * a different check are ignored. A blank check name, or a past
 * run without a string status, is an error — never a fabricated
 * classification.
 */
import type { PastRun, RerunPlanResult } from "./types.js";

export const VERSION = "0.1.0";

/** Substrings (lowercase) that mark an infrastructure-flavoured error. */
export const INFRA_PATTERNS = [
  "timeout",
  "timed out",
  "econnreset",
  "connection reset",
  "socket hang up",
  "dns",
  "network",
  "rate limit",
  "too many requests",
  "runner lost",
  "runner died",
  "service unavailable",
  "bad gateway",
  "gateway timeout",
  "internal error",
  "http 429",
  "http 502",
  "http 503",
] as const;

const PASS_STATUSES = new Set(["success", "pass", "passed"]);
const FAIL_STATUSES = new Set(["failure", "fail", "failed", "error"]);

function matchesInfra(signature: string | undefined): string | null {
  if (!signature) return null;
  const lower = signature.toLowerCase();
  return INFRA_PATTERNS.find((p) => lower.includes(p)) ?? null;
}

/** Classify a failed check from its past-run evidence. */
export function planRerun(
  check: unknown,
  errorSignature: unknown,
  pastRuns: unknown,
): RerunPlanResult {
  const name = typeof check === "string" ? check.trim() : "";
  if (!name) throw new Error("check is required");
  const signature =
    errorSignature === undefined || errorSignature === null
      ? undefined
      : typeof errorSignature === "string"
        ? errorSignature
        : (() => {
            throw new Error("error_signature must be a string");
          })();
  if (!Array.isArray(pastRuns)) {
    throw new Error("past_runs is required and must be a list of past run objects");
  }
  const runs: PastRun[] = pastRuns.map((entry, i) => {
    if (typeof entry !== "object" || entry === null || typeof (entry as PastRun).status !== "string") {
      throw new Error(`past_runs[${i}] must be an object with a string status`);
    }
    return entry as PastRun;
  });

  const considered = runs.filter((run) => {
    if (run.check !== undefined && run.check !== name) return false;
    const status = run.status.toLowerCase();
    return PASS_STATUSES.has(status) || FAIL_STATUSES.has(status);
  });
  const passes = considered.filter((r) => PASS_STATUSES.has(r.status.toLowerCase())).length;
  const failures = considered.length - passes;
  const sameSignatureFailures =
    signature === undefined
      ? 0
      : considered.filter(
          (r) => FAIL_STATUSES.has(r.status.toLowerCase()) && r.error_signature === signature,
        ).length;

  const past_summary = {
    considered_runs: considered.length,
    passes,
    failures,
    same_signature_failures: sameSignatureFailures,
  };
  const evidence: string[] = [];

  // Rule 1 — no usable history.
  if (considered.length === 0) {
    evidence.push(`no usable past runs for check '${name}'`);
    return {
      check: name,
      classification: "insufficient_evidence",
      recommendation: "investigate",
      evidence,
      past_summary,
    };
  }
  evidence.push(
    `${considered.length} usable past runs for '${name}': ${passes} passed, ${failures} failed`,
  );

  // Rule 2 — intermittent same-signature failure.
  if (passes > 0 && sameSignatureFailures > 0) {
    evidence.push(
      `the current error signature also failed ${sameSignatureFailures} time(s) in past runs, yet the check passed ${passes} time(s) — the failure comes and goes`,
    );
    return { check: name, classification: "flaky", recommendation: "rerun", evidence, past_summary };
  }

  // Rule 3 — infrastructure-flavoured signature, not failing every time.
  const infra = matchesInfra(signature);
  if (infra && !(failures === considered.length && sameSignatureFailures === failures)) {
    evidence.push(`the current error signature matches the infrastructure pattern '${infra}'`);
    return {
      check: name,
      classification: "infra_flake",
      recommendation: "rerun",
      evidence,
      past_summary,
    };
  }

  // Rule 4 — consistent failure.
  if (passes === 0 && failures > 0 && (signature === undefined || sameSignatureFailures === failures)) {
    evidence.push(
      signature === undefined
        ? "the check failed in every usable past run and has never passed"
        : `the check failed in every usable past run, always with the current error signature (${sameSignatureFailures}/${failures})`,
    );
    return {
      check: name,
      classification: "real_failure",
      recommendation: "fix",
      evidence,
      past_summary,
    };
  }

  // Rule 5 — mixed history, no rule fired.
  evidence.push("the past-run history is mixed and matches no classification rule");
  return {
    check: name,
    classification: "insufficient_evidence",
    recommendation: "investigate",
    evidence,
    past_summary,
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
