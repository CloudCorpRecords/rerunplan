#!/usr/bin/env node
/**
 * rerunplan CLI.
 *
 *   rerunplan plan --check <name> [--signature <s>] --past <past-runs.json>
 *   rerunplan mcp
 *
 * The past-runs file is a JSON array of {check?, status,
 * error_signature?} objects. Pure local computation: no
 * network, no configuration. Argument validation happens
 * before any file is read.
 * Exit codes: 0 success, 1 runtime error (including an
 * unreadable or invalid past-runs file), 2 usage error.
 */
import { readFileSync } from "node:fs";
import { formatPayload, planRerun, VERSION } from "./rerunplan.js";

function usage(): never {
  console.error(`Usage:
  rerunplan plan --check <name> [--signature <s>] --past <past-runs.json>
  rerunplan mcp
  rerunplan --version`);
  process.exit(2);
}

function flag(rest: string[], name: string): string | undefined {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (cmd !== "plan") usage();

  // ---- Argument validation (before any file is read) ----
  const flags = ["--check", "--signature", "--past"];
  if (rest.some((a) => a.startsWith("--") && !flags.includes(a))) usage();
  const check = flag(rest, "--check");
  const pastPath = flag(rest, "--past");
  if (check === undefined || !check.trim() || pastPath === undefined) usage();
  const signature = flag(rest, "--signature");
  if (rest.includes("--signature") && signature === undefined) usage();

  let pastRuns: unknown;
  try {
    pastRuns = JSON.parse(readFileSync(pastPath, "utf8"));
  } catch (err) {
    console.error(
      `error: cannot read or parse past-runs file '${pastPath}': ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  try {
    const out = planRerun(check, signature, pastRuns);
    console.log(formatPayload(out));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
