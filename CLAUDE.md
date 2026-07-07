# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`draftlytic-mcp` is an offline MCP server (stdio transport) that turns a rough project idea into a structured spec (PRD). It exposes tools to validate, render, and checklist a spec, plus one prompt to drive the whole flow. No network calls, no API key — the *client's* model does all the actual writing; this server only supplies schema, validation, and deterministic rendering logic.

It also lives as a subdirectory (`mcp-server/`) inside a larger `draftlytic` monorepo but ships/publishes as this standalone repo — see `PUBLISHING.md` for the split/publish process. There's no runtime dependency on the main `draftlytic` app or its backend.

## Commands

```bash
npm run build   # tsc compile, src/ -> dist/
npm run smoke    # build + scripts/smoke.mjs (spawns dist/index.js, runs raw MCP initialize/tools-list/prompts-list over stdio, asserts expected tools/prompt are present)
```

There is no unit test suite — `smoke` is the only automated check, and `prepublishOnly` runs `build` before every `npm publish`. When changing tool/prompt registration in `src/index.ts`, update `EXPECTED_TOOLS`/the prompt check in `scripts/smoke.mjs` if names change.

To exercise the server manually against a real MCP client, add it as a local path-based server (e.g. `claude mcp add draftlytic -- node /path/to/dist/index.js`) after building.

## Architecture

Everything is under `src/`, one concern per file, wired together in `src/index.ts`:

- **`spec-schema.ts`** — the single source of truth for the spec shape (Zod `SpecSchema`), plus a hand-maintained `specJsonSchemaDescription` string used in tool descriptions. This schema is intentionally *not* a copy of the main Draftlytic app's DB/AI schema — it's a standalone contract. If you change `SpecSchema`, update `specJsonSchemaDescription` and the README's spec-shape block, and bump at least the minor version in `package.json`.
- **`validate-spec.ts`** — `validateSpec()`: Zod-parses the input, then runs two heuristic passes over the parsed data — `scanForPlaceholders` (regex-based detection of `TBD`/`lorem ipsum`/`fixme`/etc., reported as blocking `error`s) and `scanQualityHints` (non-blocking `hint`s like "no acceptance_criteria on must-haves"). Structural Zod errors and placeholder hits share the same `error` severity; only quality nudges are `hint`.
- **`render-prd.ts`** — `renderPrd()`: pure, deterministic Spec -> Markdown. Always calls `validateSpec` internally (via `index.ts`) first and refuses to render on structural errors; renders anyway through hints/incomplete-but-valid specs. Table cell values go through `escapeCell` (escapes `|`, collapses newlines) since features/data-model/screens render as Markdown tables.
- **`checklist.ts`** — static `SPEC_CHECKLIST` data (categories + questions), no logic. This is what `spec_checklist` and the `plan_project` prompt tell the client model to interview the user with.
- **`open-in-draftlytic.ts`** — builds a URL back to the hosted `draftlytic.com` app. `buildIdeaBrief()` compresses a (possibly partial) spec into a plain-text brief; `buildHandoffUrl()` URL-encodes it with UTM params. Local string building only — no network I/O.
- **`index.ts`** — registers everything on an `McpServer` (from `@modelcontextprotocol/sdk`): four tools (`validate_spec`, `render_prd`, `spec_checklist`, `open_in_draftlytic`) and one prompt (`plan_project`). The prompt's returned text is the actual orchestration logic — it instructs the client model to call `spec_checklist`, draft a spec, loop `validate_spec` -> fix -> until clean, then `render_prd`. If you add a tool, it belongs here and its rationale/step order should stay reflected in both `SERVER_INSTRUCTIONS` and the `plan_project` prompt text.

Data flow for the intended flow: `plan_project` prompt -> client interviews user via `spec_checklist` -> client drafts spec JSON matching `spec-schema.ts` -> `validate_spec` (loop until no errors) -> `render_prd` -> Markdown handed to user. `open_in_draftlytic` is a side branch, not part of that loop.

Nothing is persisted between calls — the spec JSON lives only in the conversation; each tool is a pure function of its input.
