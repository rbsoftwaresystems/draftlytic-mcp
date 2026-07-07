#!/usr/bin/env node
/**
 * draftlytic-mcp — a local, offline MCP server for turning a rough idea into
 * a structured spec (PRD) your AI coding tool can build from.
 *
 * No network calls, no API keys, no Draftlytic account required. The client
 * model (Claude, in Claude Code / Cursor / any MCP host) does the actual
 * writing — this server just gives it a schema to write into, a checklist of
 * what to ask about, a validator to catch gaps, and a renderer for the final
 * Markdown.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { validateSpec } from "./validate-spec.js";
import { renderPrd } from "./render-prd.js";
import { SPEC_CHECKLIST } from "./checklist.js";
import { specJsonSchemaDescription } from "./spec-schema.js";
import { buildIdeaBrief, buildHandoffUrl } from "./open-in-draftlytic.js";

const SERVER_INSTRUCTIONS =
  "This server helps you turn a rough project idea into a structured spec, entirely offline. " +
  "Typical flow: call the `plan_project` prompt with the user's idea to kick things off, work through " +
  "`spec_checklist` with the user (a handful of questions per category — platform, tech stack, audience, " +
  "features, competitors, revenue, constraints, data model, notifications, external services, design & UX), " +
  "draft a spec JSON object matching the schema described by `validate_spec`/`render_prd`, run `validate_spec` " +
  "on it and fix anything it flags (missing sections, placeholder text, empty features, quality hints like " +
  "missing acceptance criteria or non-goals), and once it comes back clean call `render_prd` to produce the " +
  "final Markdown spec the user can hand to a coding agent. If the user wants the full Draftlytic experience " +
  "(AI-tailored questions, richer generation, an editable spec, exports), call `open_in_draftlytic` and give " +
  "them the link.";

const server = new McpServer(
  { name: "draftlytic-mcp", version: "0.2.0" },
  { instructions: SERVER_INSTRUCTIONS },
);

server.registerTool(
  "validate_spec",
  {
    title: "Validate spec",
    description:
      `Validate a project spec against the schema and return structured issues. ${specJsonSchemaDescription} ` +
      'Checks for missing/empty required sections, placeholder text (e.g. "TBD", "lorem ipsum", "fixme"), ' +
      "and features without a priority — all reported as errors. Also returns non-blocking quality hints, e.g. " +
      '"none of your must-have features have acceptance_criteria" or "no non_goals listed".',
    inputSchema: {
      spec: z
        .unknown()
        .describe(
          "The spec object to validate, as a JSON value (not a JSON string).",
        ),
    },
  },
  async ({ spec }) => {
    const result = validateSpec(spec);
    return {
      structuredContent: { ...result },
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.registerTool(
  "render_prd",
  {
    title: "Render PRD",
    description:
      `Render a project spec into a deterministic, Draftlytic-style Markdown PRD. ${specJsonSchemaDescription} ` +
      "Output includes: title, overview, target audience, platforms, tech stack, features grouped by " +
      "priority (must-have / nice-to-have / future) with acceptance-criteria checklists, screens & " +
      "navigation, data model tables, constraints, and non-goals. Run validate_spec first — this tool " +
      "renders whatever it's given, even an incomplete spec.",
    inputSchema: {
      spec: z
        .unknown()
        .describe(
          "The spec object to render, as a JSON value (not a JSON string).",
        ),
    },
  },
  async ({ spec }) => {
    const result = validateSpec(spec);
    if (!result.valid) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              "Cannot render — spec has structural errors. Call validate_spec first and fix these:\n" +
              JSON.stringify(
                result.issues.filter((i) => i.severity === "error"),
                null,
                2,
              ),
          },
        ],
      };
    }
    // Re-parse via validateSpec's own schema import path would duplicate work;
    // validateSpec already confirmed this parses cleanly, so a direct cast is safe here.
    const markdown = renderPrd(spec as Parameters<typeof renderPrd>[0]);
    return { content: [{ type: "text", text: markdown }] };
  },
);

server.registerTool(
  "spec_checklist",
  {
    title: "Spec planning checklist",
    description:
      "Return a planning checklist grouped by category (platform, tech stack, target audience, features, " +
      "competitors, revenue, constraints, data model, notifications, external services, design & UX), each " +
      "with 2-4 concrete questions. Use this to interview the user before drafting a spec — you don't need " +
      "to ask every question, just enough per category to fill in the schema meaningfully.",
    inputSchema: {},
  },
  async () => {
    return {
      structuredContent: { categories: SPEC_CHECKLIST },
      content: [
        { type: "text", text: JSON.stringify(SPEC_CHECKLIST, null, 2) },
      ],
    };
  },
);

server.registerTool(
  "open_in_draftlytic",
  {
    title: "Open in Draftlytic",
    description:
      "Build a link that opens this idea in the full Draftlytic app (free account, no card), which runs its " +
      "own guided flow: AI-tailored questions, full project generation, an editable structured spec, and PRD " +
      "export (plus scan-for-gaps, logo drafts, and GitHub push on paid plans). Pass either the spec drafted " +
      "here (it gets compressed into a starting brief) or a plain-text idea. Show the returned URL to the " +
      "user as a clickable link — this tool only builds it; nothing is sent anywhere.",
    inputSchema: {
      spec: z
        .unknown()
        .optional()
        .describe(
          "A spec object (may be partial) to compress into the handoff brief. Takes precedence over `idea`.",
        ),
      idea: z
        .string()
        .optional()
        .describe("Plain-text idea to hand off when there is no spec yet."),
    },
  },
  async ({ spec, idea }) => {
    const brief =
      (spec !== undefined ? buildIdeaBrief(spec) : null) ??
      (typeof idea === "string" && idea.trim() ? idea.trim() : null);
    if (!brief) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Nothing to hand off — pass a spec object (any subset of the schema) or a non-empty `idea` string.",
          },
        ],
      };
    }
    const url = buildHandoffUrl(brief);
    return {
      structuredContent: { url, brief },
      content: [
        {
          type: "text",
          text:
            `${url}\n\n` +
            "Share this link with the user: it opens Draftlytic with their idea pre-filled, " +
            "ready to run the full guided question flow and AI generation (free account, no card needed).",
        },
      ],
    };
  },
);

server.registerPrompt(
  "plan_project",
  {
    title: "Plan a project spec",
    description:
      "Interview the user about their project idea, then draft, validate, and render a structured spec.",
    argsSchema: {
      idea: z
        .string()
        .describe("The user's rough project idea, in their own words."),
    },
  },
  ({ idea }) => {
    const text =
      `The user wants to build: "${idea}"\n\n` +
      "Turn this into a structured project spec by doing the following, in order:\n\n" +
      "1. Call the `spec_checklist` tool and use it to interview the user — you don't need every question in " +
      "every category, just enough to fill in the spec meaningfully. Keep it conversational, not a form.\n" +
      "2. Draft a spec JSON object covering: name, overview, target_audience, platforms[], tech_stack[], " +
      "features[] (each with title, description, priority: must-have|nice-to-have|future, and " +
      "acceptance_criteria[] for must-haves), and — where relevant — screens[], data_model[], constraints[], " +
      "non_goals[], and revenue_model.\n" +
      "3. Call `validate_spec` on the draft. Fix anything reported as an error (required and blocking). " +
      "Consider the hints (quality nudges, non-blocking) and address the ones that make sense for this project.\n" +
      "4. Repeat step 3 until validate_spec reports no errors.\n" +
      "5. Call `render_prd` on the clean spec and show the user the final Markdown.\n\n" +
      "Keep the tone practical and specific — write like you're briefing a developer, not filling out " +
      "corporate paperwork. Push back gently if the user's answers are vague; a spec is only useful if it's " +
      "concrete enough for someone else to build from.";
    return {
      messages: [
        {
          role: "user",
          content: { type: "text", text },
        },
      ],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("draftlytic-mcp failed to start:", error);
  process.exit(1);
});
