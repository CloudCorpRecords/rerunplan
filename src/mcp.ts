/**
 * rerunplan MCP server. Tools: plan_rerun.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schemas as explicit literals, while zod
 * still validates every tools/call argument set.
 *
 * The classification is pure local computation: no upstream
 * API, no authentication, no configuration.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { formatPayload, planRerun, VERSION } from "./rerunplan.js";

const PlanArgs = z.object({
  check: z.string().min(1),
  error_signature: z.string().optional(),
  past_runs: z
    .array(
      z.object({
        check: z.string().optional(),
        status: z.string(),
        error_signature: z.string().optional(),
      }),
    ),
});

const TOOLS = [
  {
    name: "plan_rerun",
    description:
      "Classify a failed check as infra_flake, flaky, real_failure, or insufficient_evidence from its past-run history, and recommend rerun, fix, or investigate — with the evidence that drove the call.",
    inputSchema: {
      type: "object" as const,
      properties: {
        check: { type: "string", description: "The failed check's name" },
        error_signature: {
          type: "string",
          description: "The current failure's error signature (optional)",
        },
        past_runs: {
          type: "array",
          description: "Past runs; runs for other checks are ignored",
          items: {
            type: "object",
            properties: {
              check: { type: "string", description: "Check name (optional)" },
              status: { type: "string", description: "Run status (success/pass/passed or failure/fail/failed/error)" },
              error_signature: { type: "string", description: "The run's error signature, when it failed with one" },
            },
            required: ["status"],
          },
        },
      },
      required: ["check", "past_runs"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "rerunplan", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "plan_rerun") {
      const parsed = PlanArgs.parse(args ?? {});
      out = planRerun(parsed.check, parsed.error_signature, parsed.past_runs);
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
