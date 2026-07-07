# draftlytic-mcp

An MCP server that turns a rough project idea into a structured spec — right inside Claude Code, Cursor, or any MCP-compatible editor. No API key, no account, no network calls. It runs entirely on your machine and hands your editor's model a schema to write into, a checklist of what to ask about, a validator that catches gaps before you start coding, and a renderer that turns the result into a clean Markdown PRD.

This exists because "vibe coding" from a one-line prompt tends to produce a plausible-looking app that's missing half the decisions you actually needed to make — what's in scope for v1, what the data model looks like, what "done" means for a feature. draftlytic-mcp doesn't generate any of that for you; it structures the conversation so your model asks the right questions, then checks its own homework before you start building.

## Install

### Claude Code

```bash
claude mcp add draftlytic -- npx -y draftlytic-mcp
```

### Cursor

Add to `.cursor/mcp.json` in your project (or the global `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "draftlytic": {
      "command": "npx",
      "args": ["-y", "draftlytic-mcp"]
    }
  }
}
```

### Any other MCP client

Most MCP hosts read a generic `mcp.json` with the same shape:

```json
{
  "mcpServers": {
    "draftlytic": {
      "command": "npx",
      "args": ["-y", "draftlytic-mcp"]
    }
  }
}
```

## Usage

Once connected, ask your editor's model something like:

> Use the plan_project prompt for "a habit tracker that reminds me by text message"

It'll walk through `spec_checklist` with you (platform, tech stack, audience, features, competitors, revenue, constraints, data model, notifications, external services, design & UX — a handful of concrete questions per category, many offered as click-to-pick single/multi-select choices rather than blank prompts, with a free-text escape always available), draft a spec, run it through `validate_spec`, fix what comes back, and hand you a rendered PRD in Markdown you can drop straight into a coding-agent prompt, a `SPEC.md`, or a GitHub issue.

You can also call the tools directly if you already have a spec drafted (by hand, or from another source) and just want it checked and rendered.

## Tool reference

| Tool                 | Input                                             | What it does                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validate_spec`      | `spec` (JSON object)                              | Zod-validates the spec and returns structured issues: errors for missing/empty required sections, placeholder text (`TBD`, `lorem ipsum`, `fixme`, etc.), and features without a priority — plus non-blocking quality hints like "no acceptance criteria on your must-haves" or "no non_goals listed".                                  |
| `render_prd`         | `spec` (JSON object)                              | Renders a validated spec into deterministic Markdown: title, overview, target audience, platforms, tech stack, features grouped by priority with acceptance-criteria checklists, screens & navigation, data model tables, constraints, and non-goals. Refuses to render (returns an error) if the spec has structural errors.           |
| `spec_checklist`     | —                                                 | Returns the planning checklist grouped by category, each with 2-4 concrete questions. Each question is `{ prompt, options?, multiSelect? }` — questions with `options` are meant to be shown as selectable single/multi-choice answers (with a free-text escape), open ones stay free-text.                                              |
| `open_in_draftlytic` | `spec` (JSON object, optional) or `idea` (string) | Builds a link that opens your idea in the full Draftlytic app with the brief pre-filled — its guided AI question flow, richer generation, an editable spec editor, and PRD export live there. Compresses a spec (even a partial one) into a starting brief, or takes a plain-text idea. Builds the URL locally; sends nothing anywhere. |

Plus one prompt:

| Prompt         | Args            | What it does                                                                                                                             |
| -------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `plan_project` | `idea` (string) | Instructs the model to interview the user with `spec_checklist`, draft a spec, validate and fix it in a loop, then render the final PRD. |

### The spec shape

```
{
  name: string
  overview: string
  target_audience: string
  platforms: string[]
  tech_stack: string[]
  features: Array<{
    title: string
    description: string
    priority: "must-have" | "nice-to-have" | "future"
    acceptance_criteria?: string[]
  }>
  screens?: Array<{ name: string; purpose: string }>
  data_model?: Array<{
    entity: string
    fields: Array<{ name: string; type: string; notes?: string }>
  }>
  constraints?: string[]
  non_goals?: string[]
  revenue_model?: string
}
```

## Honest limits

- **This is v1 and purely local.** There's no Draftlytic API behind it — every tool runs synchronous, offline logic against whatever spec JSON your editor's model hands it. It doesn't call any AI itself.
- **The model does the writing, this just structures it.** `validate_spec` and `spec_checklist` are heuristics, not a substitute for actually knowing what you're building. A spec that passes validation can still be a bad plan.
- **Placeholder detection is pattern-based**, not semantic. It catches `TBD`/`lorem ipsum`/`fixme`-style filler, not "this description is vague but technically real words."
- **No persistence.** Nothing is saved between calls — the spec JSON lives in the conversation. If you want it saved, ask your model to write it to a file.
- **No collaboration, no versioning, no export formats beyond Markdown.** It's a planning tool, not a project manager.

---

draftlytic-mcp is the offline sibling of [draftlytic.com](https://draftlytic.com?utm_source=github&utm_medium=mcp-readme) — the full editor adds AI generation, logo drafts, scan-for-gaps, and GitHub push.
