#!/usr/bin/env node
/**
 * Smoke test: spawns the built server over stdio, sends a raw MCP
 * `initialize` request followed by `tools/list`, and asserts the three
 * expected tools are present. No test framework — this is a pre-publish
 * sanity check, not a unit-test suite.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "dist", "index.js");

const EXPECTED_TOOLS = [
  "validate_spec",
  "render_prd",
  "spec_checklist",
  "open_in_draftlytic",
];

function jsonRpcMessage(payload) {
  return JSON.stringify(payload) + "\n";
}

async function main() {
  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdoutBuffer = "";
  const responses = [];

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

  let stderrOutput = "";
  child.stderr.on("data", (chunk) => {
    stderrOutput += chunk.toString("utf8");
  });

  const exitPromise = new Promise((resolve) => {
    child.on("exit", (code) => resolve(code));
  });

  function waitForResponse(id, timeoutMs = 5000) {
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
            new Error(`Timed out waiting for response to request id ${id}`),
          );
        }
      }, 25);
    });
  }

  try {
    child.stdin.write(
      jsonRpcMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "smoke-test", version: "0.0.0" },
        },
      }),
    );

    const initResponse = await waitForResponse(1);
    if (initResponse.error) {
      throw new Error(
        `initialize failed: ${JSON.stringify(initResponse.error)}`,
      );
    }
    if (!initResponse.result?.serverInfo?.name) {
      throw new Error("initialize response missing serverInfo.name");
    }
    console.log(
      `[smoke] initialized: ${initResponse.result.serverInfo.name} v${initResponse.result.serverInfo.version}`,
    );

    child.stdin.write(
      jsonRpcMessage({ jsonrpc: "2.0", method: "notifications/initialized" }),
    );

    child.stdin.write(
      jsonRpcMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    );

    const toolsResponse = await waitForResponse(2);
    if (toolsResponse.error) {
      throw new Error(
        `tools/list failed: ${JSON.stringify(toolsResponse.error)}`,
      );
    }

    const toolNames = (toolsResponse.result?.tools ?? []).map((t) => t.name);
    console.log(`[smoke] tools reported: ${toolNames.join(", ")}`);

    const missing = EXPECTED_TOOLS.filter((name) => !toolNames.includes(name));
    if (missing.length > 0) {
      throw new Error(`Missing expected tools: ${missing.join(", ")}`);
    }

    child.stdin.write(
      jsonRpcMessage({
        jsonrpc: "2.0",
        id: 3,
        method: "prompts/list",
        params: {},
      }),
    );
    const promptsResponse = await waitForResponse(3);
    const promptNames = (promptsResponse.result?.prompts ?? []).map(
      (p) => p.name,
    );
    console.log(`[smoke] prompts reported: ${promptNames.join(", ")}`);
    if (!promptNames.includes("plan_project")) {
      throw new Error("Missing expected prompt: plan_project");
    }

    console.log("[smoke] OK — all expected tools and prompts present");
    child.kill();
    process.exit(0);
  } catch (err) {
    console.error("[smoke] FAILED:", err.message);
    if (stderrOutput) console.error("[smoke] server stderr:\n" + stderrOutput);
    child.kill();
    await exitPromise;
    process.exit(1);
  }
}

main();
