import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planRerun } from "../src/rerunplan.js";

/**
 * All tests are pure local computation over inline past-run
 * histories: no filesystem, no network. Each classification
 * rule is pinned by its own case.
 */

describe("planRerun — classifications", () => {
  it("classifies an intermittent same-signature failure as flaky / rerun", () => {
    const out = planRerun("unit-tests", "Error: boom", [
      { check: "unit-tests", status: "success" },
      { check: "unit-tests", status: "failure", error_signature: "Error: boom" },
      { check: "unit-tests", status: "success" },
    ]);
    assert.equal(out.classification, "flaky");
    assert.equal(out.recommendation, "rerun");
    assert.equal(out.past_summary.same_signature_failures, 1);
    assert.match(out.evidence.join(" "), /comes and goes/);
  });

  it("classifies a timeout failure with a passing history as infra_flake / rerun", () => {
    const out = planRerun("e2e", "Request timeout after 30s", [
      { check: "e2e", status: "success" },
      { check: "e2e", status: "success" },
    ]);
    assert.equal(out.classification, "infra_flake");
    assert.equal(out.recommendation, "rerun");
    assert.match(out.evidence.join(" "), /infrastructure pattern 'timeout'/);
  });

  it("classifies consistent same-signature failures as real_failure / fix", () => {
    const out = planRerun("build", "TS2304: cannot find name 'x'", [
      { status: "failure", error_signature: "TS2304: cannot find name 'x'" },
      { status: "failed", error_signature: "TS2304: cannot find name 'x'" },
      { status: "error", error_signature: "TS2304: cannot find name 'x'" },
    ]);
    assert.equal(out.classification, "real_failure");
    assert.equal(out.recommendation, "fix");
    assert.equal(out.past_summary.passes, 0);
    assert.equal(out.past_summary.same_signature_failures, 3);
  });

  it("does not let an infra pattern rescue a failure that happens every time", () => {
    const out = planRerun("deploy", "HTTP 503 from registry", [
      { status: "failure", error_signature: "HTTP 503 from registry" },
      { status: "failure", error_signature: "HTTP 503 from registry" },
    ]);
    assert.equal(out.classification, "real_failure");
    assert.equal(out.recommendation, "fix");
  });

  it("classifies consistent failures without a signature as real_failure", () => {
    const out = planRerun("lint", undefined, [
      { status: "failure" },
      { status: "failure" },
    ]);
    assert.equal(out.classification, "real_failure");
    assert.equal(out.recommendation, "fix");
  });

  it("returns insufficient_evidence when there is no usable history", () => {
    const empty = planRerun("new-check", "boom", []);
    assert.equal(empty.classification, "insufficient_evidence");
    assert.equal(empty.recommendation, "investigate");
    const otherCheck = planRerun("new-check", "boom", [{ check: "other", status: "success" }]);
    assert.equal(otherCheck.classification, "insufficient_evidence");
    assert.equal(otherCheck.past_summary.considered_runs, 0);
  });

  it("returns insufficient_evidence for mixed history no rule claims", () => {
    // Passed before, failed before but only with a DIFFERENT signature,
    // current signature matches no infra pattern.
    const out = planRerun("api", "AssertionError: expected 200", [
      { status: "success" },
      { status: "failure", error_signature: "TypeError: fetch failed differently" },
    ]);
    assert.equal(out.classification, "insufficient_evidence");
    assert.equal(out.recommendation, "investigate");
  });

  it("ignores runs for other checks and unrecognised statuses", () => {
    const out = planRerun("unit", "sig", [
      { check: "other", status: "failure", error_signature: "sig" },
      { check: "unit", status: "cancelled" },
      { check: "unit", status: "Passed" },
      { check: "unit", status: "FAILURE", error_signature: "sig" },
    ]);
    assert.equal(out.past_summary.considered_runs, 2);
    assert.equal(out.classification, "flaky");
  });
});

describe("planRerun — input validation", () => {
  it("rejects a blank check name and a non-list past_runs", () => {
    assert.throws(() => planRerun(" ", "s", []), /check is required/);
    assert.throws(() => planRerun("x", "s", "nope"), /past_runs is required/);
  });

  it("rejects malformed past runs and a non-string signature", () => {
    assert.throws(() => planRerun("x", "s", [{ noStatus: true }]), /past_runs\[0\] must be an object/);
    assert.throws(() => planRerun("x", 42, []), /error_signature must be a string/);
  });
});
