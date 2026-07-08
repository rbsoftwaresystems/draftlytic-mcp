/**
 * Integration test: drives the built MCP server (dist/index.js) over stdio,
 * exercising the real tool/prompt handlers via raw JSON-RPC — no mocking of
 * the SDK internals. Mirrors the stdio pattern in scripts/smoke.mjs, but
 * asserts on actual response payloads instead of just presence checks.
 *
 * A single server child process is spawned once (in `before`) and reused
 * across all tests in this file to keep runtime modest; each test sends its
 * own request(s) with a fresh incrementing id and matches responses by id so
 * ordering/interleaving can't cause cross-talk.
 *
 * NOTE: hooks/tests are nested inside a `describe` block on purpose — a
 * top-level `before()` (outside any `describe`) does not reliably block
 * test execution on Node 20.13's test runner (tests can start running before
 * the async `before` resolves), verified empirically. Inside `describe` the
 * ordering is correctly enforced.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validSpec } from "./fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "dist", "index.js");

const DEFAULT_TIMEOUT = 5000;

describe("draftlytic-mcp stdio integration", () => {
  let child;
  let stdoutBuffer = "";
  const responses = [];
  let nextId = 1;
  let initResult;
  let stderrOutput = "";

  function jsonRpcMessage(payload) {
    return JSON.stringify(payload) + "\n";
  }

  function waitForResponse(id, timeoutMs = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        const found = responses.find((r) => r.id === id);
        if (found) {
          clearInterval(interval);
          resolve(found);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(
            new Error(
              `Timed out waiting for response to request id ${id}. stderr:\n${stderrOutput}`,
            ),
          );
        }
      }, 25);
    });
  }

  /** Send a JSON-RPC request and return a function to await its response. */
  function send(method, params) {
    const id = nextId++;
    child.stdin.write(jsonRpcMessage({ jsonrpc: "2.0", id, method, params }));
    return (timeoutMs) => waitForResponse(id, timeoutMs);
  }

  function notify(method, params) {
    child.stdin.write(jsonRpcMessage({ jsonrpc: "2.0", method, params }));
  }

  async function callTool(name, args, timeoutMs) {
    const wait = send("tools/call", { name, arguments: args });
    const res = await wait(timeoutMs);
    if (res.error) {
      throw new Error(
        `tools/call ${name} returned a JSON-RPC error: ${JSON.stringify(res.error)}`,
      );
    }
    return res.result;
  }

  async function getPrompt(name, args, timeoutMs) {
    const wait = send("prompts/get", { name, arguments: args });
    const res = await wait(timeoutMs);
    if (res.error) {
      throw new Error(
        `prompts/get ${name} returned a JSON-RPC error: ${JSON.stringify(res.error)}`,
      );
    }
    return res.result;
  }

  async function rawRequest(method, params, timeoutMs) {
    const wait = send(method, params);
    return wait(timeoutMs);
  }

  before(async () => {
    child = spawn(process.execPath, [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString("utf8");
      let newlineIndex;
      while ((newlineIndex = stdoutBuffer.indexOf("\n")) !== -1) {
        const line = stdoutBuffer.slice(0, newlineIndex).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        if (!line) continue;
        try {
          responses.push(JSON.parse(line));
        } catch {
          // Ignore non-JSON lines (shouldn't happen on a clean stdio server).
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderrOutput += chunk.toString("utf8");
    });

    const wait = send("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "index-test", version: "0.0.0" },
    });
    const initResponse = await wait();
    if (initResponse.error) {
      throw new Error(
        `initialize failed: ${JSON.stringify(initResponse.error)}`,
      );
    }
    initResult = initResponse.result;

    notify("notifications/initialized");
  });

  after(() => {
    if (child && !child.killed) {
      child.kill();
    }
  });

  // ---------------------------------------------------------------------
  // initialize
  // ---------------------------------------------------------------------

  test("initialize reports serverInfo.name, a version string, and non-empty instructions", () => {
    assert.equal(initResult.serverInfo.name, "draftlytic-mcp");
    assert.equal(typeof initResult.serverInfo.version, "string");
    assert.ok(initResult.serverInfo.version.length > 0);
    assert.equal(typeof initResult.instructions, "string");
    assert.ok(initResult.instructions.length > 0);
  });

  // ---------------------------------------------------------------------
  // tools/list, prompts/list
  // ---------------------------------------------------------------------

  test("tools/list reports exactly the four expected tools", async () => {
    const res = await rawRequest("tools/list", {});
    assert.equal(res.error, undefined);
    const names = (res.result.tools ?? []).map((t) => t.name).sort();
    assert.deepEqual(names, [
      "open_in_draftlytic",
      "render_prd",
      "spec_checklist",
      "validate_spec",
    ]);
  });

  // Regression guard: the object-typed `spec` param must advertise
  // `type: "object"` in its JSON schema. A typeless param (the old
  // `z.unknown()`) led MCP clients to serialize the spec as a JSON *string*,
  // which broke every downstream parse.
  test("tools/list: spec params advertise type:object so clients don't stringify", async () => {
    const res = await rawRequest("tools/list", {});
    const byName = Object.fromEntries(
      (res.result.tools ?? []).map((t) => [t.name, t]),
    );

    for (const name of ["validate_spec", "render_prd"]) {
      const specSchema = byName[name].inputSchema.properties.spec;
      assert.equal(specSchema.type, "object", `${name}.spec must be type:object`);
      assert.ok(
        (byName[name].inputSchema.required ?? []).includes("spec"),
        `${name}.spec must be required`,
      );
    }

    // open_in_draftlytic.spec is optional but must still be typed as an object.
    const openSpec = byName.open_in_draftlytic.inputSchema.properties.spec;
    assert.equal(openSpec.type, "object");
  });

  test("prompts/list includes plan_project", async () => {
    const res = await rawRequest("prompts/list", {});
    assert.equal(res.error, undefined);
    const names = (res.result.prompts ?? []).map((p) => p.name);
    assert.ok(names.includes("plan_project"));
  });

  // ---------------------------------------------------------------------
  // validate_spec
  // ---------------------------------------------------------------------

  test("validate_spec: a fully-populated valid spec is valid with zero issues", async () => {
    const result = await callTool("validate_spec", { spec: validSpec() });
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent.valid, true);
    assert.deepEqual(result.structuredContent.issues, []);
  });

  test("validate_spec: a structurally-broken spec ({}) is invalid with error issues", async () => {
    const result = await callTool("validate_spec", { spec: {} });
    assert.equal(result.structuredContent.valid, false);
    assert.ok(result.structuredContent.issues.length > 0);
    assert.ok(
      result.structuredContent.issues.every((i) => i.severity === "error"),
    );
  });

  test("validate_spec: content[0].text is JSON matching structuredContent", async () => {
    const result = await callTool("validate_spec", { spec: {} });
    const parsedText = JSON.parse(result.content[0].text);
    assert.deepEqual(parsedText, result.structuredContent);
  });

  // ---------------------------------------------------------------------
  // render_prd
  // ---------------------------------------------------------------------

  test("render_prd: a valid spec renders Markdown with the title heading", async () => {
    const result = await callTool("render_prd", { spec: validSpec() });
    assert.notEqual(result.isError, true);
    const text = result.content[0].text;
    assert.ok(text.includes("# TaskFlow"));
  });

  test("render_prd: an invalid spec ({}) is an error mentioning structural errors and validate_spec", async () => {
    const result = await callTool("render_prd", { spec: {} });
    assert.equal(result.isError, true);
    const text = result.content[0].text;
    assert.match(text, /structural errors/i);
    assert.ok(text.includes("validate_spec"));
  });

  // ---------------------------------------------------------------------
  // spec_checklist
  // ---------------------------------------------------------------------

  test("spec_checklist: returns 11 checklist categories", async () => {
    const result = await callTool("spec_checklist", {});
    assert.notEqual(result.isError, true);
    assert.ok(Array.isArray(result.structuredContent.categories));
    assert.equal(result.structuredContent.categories.length, 11);
  });

  // ---------------------------------------------------------------------
  // open_in_draftlytic
  // ---------------------------------------------------------------------

  test("open_in_draftlytic: with a spec returns a draftlytic.com URL and non-empty brief", async () => {
    const result = await callTool("open_in_draftlytic", { spec: validSpec() });
    assert.notEqual(result.isError, true);
    assert.ok(
      result.structuredContent.url.startsWith("https://draftlytic.com"),
    );
    assert.equal(typeof result.structuredContent.brief, "string");
    assert.ok(result.structuredContent.brief.length > 0);
  });

  test("open_in_draftlytic: with a plain idea (no spec) returns a URL", async () => {
    const result = await callTool("open_in_draftlytic", {
      idea: "a plain idea",
    });
    assert.notEqual(result.isError, true);
    assert.ok(
      result.structuredContent.url.startsWith("https://draftlytic.com"),
    );
    assert.ok(result.structuredContent.brief.includes("a plain idea"));
  });

  test("open_in_draftlytic: with neither spec nor idea is an error", async () => {
    const result = await callTool("open_in_draftlytic", {});
    assert.equal(result.isError, true);
  });

  test("open_in_draftlytic: with an empty/whitespace-only idea and no spec is an error", async () => {
    const result = await callTool("open_in_draftlytic", { idea: "   " });
    assert.equal(result.isError, true);
  });

  test("open_in_draftlytic: a partial spec still takes precedence over idea", async () => {
    const partial = { name: "Only A Name" };
    const result = await callTool("open_in_draftlytic", {
      spec: partial,
      idea: "should be ignored",
    });
    assert.notEqual(result.isError, true);
    assert.ok(result.structuredContent.brief.includes("Only A Name"));
    assert.ok(!result.structuredContent.brief.includes("should be ignored"));
  });

  // ---------------------------------------------------------------------
  // prompts/get plan_project
  // ---------------------------------------------------------------------

  test("prompts/get plan_project: embeds the idea and references the tool-call sequence", async () => {
    const result = await getPrompt("plan_project", { idea: "a todo app" });
    const text = result.messages[0].content.text;
    assert.ok(text.includes("a todo app"));
    assert.ok(text.includes("spec_checklist"));
    assert.ok(text.includes("validate_spec"));
    assert.ok(text.includes("render_prd"));
  });
});
