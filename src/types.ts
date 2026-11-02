/**
 * rerunplan types.
 *
 * rerunplan answers one question about a failed check: rerun it,
 * or fix it? It classifies the current failure from the evidence
 * supplied — the failing check's name, its error signature, and
 * past runs of the same check — into one of:
 *
 *   infra_flake            the failure looks like infrastructure
 *   flaky                  the check passes and fails across runs
 *   real_failure           the check fails consistently; fix it
 *   insufficient_evidence  not enough history to classify
 *
 * and recommends rerun / fix / investigate accordingly, with the
 * evidence strings that drove the call. All rules are local and
 * deterministic; nothing is fetched, executed, or guessed.
 */

/** One past run of a check, as supplied by the caller. */
export interface PastRun {
  /** Check name; runs for other checks are ignored. */
  check?: string;
  /** Run status: success/pass/passed count as passes; failure/fail/failed/error as failures. */
  status: string;
  /** The run's error signature, when it failed with one. */
  error_signature?: string;
}

export type Classification =
  | "infra_flake"
  | "flaky"
  | "real_failure"
  | "insufficient_evidence";

export type Recommendation = "rerun" | "fix" | "investigate";

/** The classification report. */
export interface RerunPlanResult {
  check: string;
  classification: Classification;
  recommendation: Recommendation;
  /** Human-readable evidence lines, in the order the rules fired. */
  evidence: string[];
  past_summary: {
    /** Past runs considered (same check name, recognised status). */
    considered_runs: number;
    passes: number;
    failures: number;
    /** Failures carrying the current error signature. */
    same_signature_failures: number;
  };
}
