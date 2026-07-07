import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildIdeaBrief,
  buildHandoffUrl,
} from "../dist/open-in-draftlytic.js";
import { validSpec, clone } from "./fixtures.mjs";

const UTM_SUFFIX =
  "&utm_source=mcp&utm_medium=tool&utm_campaign=pivot-2026-07";

/**
 * Pull the raw (still-encoded) value of the `idea` query param out of a
 * handoff URL, asserting the surrounding structure is exactly as expected.
 */
function extractIdeaParam(url) {
  assert.ok(
    url.startsWith("https://draftlytic.com/?idea="),
    `expected URL to start with base + idea param, got: ${url}`,
  );
  assert.ok(
    url.endsWith(UTM_SUFFIX),
    `expected URL to end with UTM suffix, got: ${url}`,
  );
  const start = "https://draftlytic.com/?idea=".length;
  const end = url.length - UTM_SUFFIX.length;
  return url.slice(start, end);
}

describe("buildIdeaBrief", () => {
  test("full validSpec() produces a brief with all sections, must-haves only", () => {
    const brief = buildIdeaBrief(validSpec());
    assert.equal(typeof brief, "string");

    assert.ok(brief.includes("TaskFlow:"), "should include name prefix");
    assert.ok(
      brief.includes(
        "A lightweight kanban board for solo developers to track side projects.",
      ),
      "should include overview text",
    );
    assert.ok(
      brief.includes(
        "For: Indie developers juggling multiple side projects.",
      ),
      "should include audience with 'For: ' prefix",
    );
    assert.ok(brief.includes("Platforms: web"), "should include platforms");
    assert.ok(
      brief.includes("Must-have features:"),
      "should include must-have features header",
    );
    assert.ok(
      brief.includes("Drag-and-drop board"),
      "should include the must-have feature title",
    );
    assert.ok(
      !brief.includes("Dark mode"),
      "should NOT include the nice-to-have feature title",
    );
    assert.ok(
      !brief.includes("Mobile app"),
      "should NOT include the future feature title",
    );
    assert.ok(brief.includes("Revenue:"), "should include revenue section");
  });

  test("only overview -> brief is exactly that overview", () => {
    const brief = buildIdeaBrief({ overview: "A neat idea for an app." });
    assert.equal(brief, "A neat idea for an app.");
  });

  test("only name -> brief is exactly that name", () => {
    const brief = buildIdeaBrief({ name: "CoolApp" });
    assert.equal(brief, "CoolApp");
  });

  test("name + overview -> brief is 'name: overview'", () => {
    const brief = buildIdeaBrief({
      name: "CoolApp",
      overview: "Does cool things.",
    });
    assert.equal(brief, "CoolApp: Does cool things.");
  });

  test("audience only (no name/overview) -> brief starts with 'For:'", () => {
    const brief = buildIdeaBrief({ target_audience: "QA testers" });
    assert.ok(brief.startsWith("For:"));
    assert.equal(brief, "For: QA testers.");
  });

  test("platforms only -> brief lists platforms", () => {
    const brief = buildIdeaBrief({ platforms: ["web", "ios"] });
    assert.equal(brief, "Platforms: web, ios.");
  });

  test("features only, mixed priorities -> only must-haves listed", () => {
    const brief = buildIdeaBrief({
      features: [
        { title: "Login", description: "d", priority: "must-have" },
        { title: "Theming", description: "d", priority: "nice-to-have" },
        { title: "Offline mode", description: "d", priority: "future" },
      ],
    });
    assert.equal(brief, "Must-have features: Login.");
  });

  test("features only with no must-haves -> null (nothing contributed)", () => {
    const brief = buildIdeaBrief({
      features: [{ title: "Theming", description: "d", priority: "nice-to-have" }],
    });
    assert.equal(brief, null);
  });

  test("revenue_model only -> brief is the revenue sentence", () => {
    const brief = buildIdeaBrief({ revenue_model: "Freemium." });
    assert.equal(brief, "Revenue: Freemium..");
  });

  test("empty object -> null (no parts at all)", () => {
    assert.equal(buildIdeaBrief({}), null);
  });

  test("minimal spec-shaped object with only blank/whitespace-free fields still null when no relevant keys", () => {
    assert.equal(buildIdeaBrief({ tech_stack: [] }), null);
  });

  test("invalid input (wrong type for name) fails partial parse -> null", () => {
    assert.equal(buildIdeaBrief({ name: 123 }), null);
  });

  test("invalid input (wrong type for platforms) fails partial parse -> null", () => {
    assert.equal(buildIdeaBrief({ platforms: "web" }), null);
  });

  test("invalid input (non-object) fails partial parse -> null", () => {
    assert.equal(buildIdeaBrief("just a raw string idea"), null);
    assert.equal(buildIdeaBrief(null), null);
    assert.equal(buildIdeaBrief(42), null);
  });

  test("truncates an overview longer than 1200 chars, ending with an ellipsis", () => {
    const longOverview = "A".repeat(1300);
    const brief = buildIdeaBrief({ overview: longOverview });
    assert.ok(brief.length <= 1200, `expected length <= 1200, got ${brief.length}`);
    assert.ok(brief.endsWith("…"), "expected brief to end with an ellipsis");
  });

  test("does not mutate the input spec object", () => {
    const spec = clone(validSpec());
    const before = JSON.stringify(spec);
    buildIdeaBrief(spec);
    assert.equal(JSON.stringify(spec), before);
  });
});

describe("buildHandoffUrl", () => {
  test("starts with the base URL and idea param, and includes UTM params", () => {
    const url = buildHandoffUrl("Hello world");
    assert.ok(url.startsWith("https://draftlytic.com/?idea="));
    assert.ok(url.includes("utm_source=mcp"));
    assert.ok(url.includes("utm_medium=tool"));
    assert.ok(url.includes("utm_campaign=pivot-2026-07"));
  });

  test("URL-encodes spaces, & and = so they don't appear raw in the idea param", () => {
    const brief = "A & B = C, plus spaces";
    const url = buildHandoffUrl(brief);
    const ideaRaw = extractIdeaParam(url);

    assert.ok(!ideaRaw.includes(" "), "raw idea param should not contain literal spaces");
    assert.ok(!ideaRaw.includes("&"), "raw idea param should not contain literal &");
    assert.ok(!ideaRaw.includes("="), "raw idea param should not contain literal =");
    assert.equal(decodeURIComponent(ideaRaw), brief);
  });

  test("round-trips arbitrary brief text through encode/decode", () => {
    const brief = "Quotes \"like this\" and slashes/back\\slashes + plus";
    const url = buildHandoffUrl(brief);
    const ideaRaw = extractIdeaParam(url);
    assert.equal(decodeURIComponent(ideaRaw), brief);
  });

  test("trims leading/trailing whitespace of the brief before encoding", () => {
    const url = buildHandoffUrl("   Hello there   ");
    const ideaRaw = extractIdeaParam(url);
    assert.equal(decodeURIComponent(ideaRaw), "Hello there");
  });

  test("trims whitespace-only brief down to an empty idea param", () => {
    const url = buildHandoffUrl("   \n\t  ");
    const ideaRaw = extractIdeaParam(url);
    assert.equal(ideaRaw, "");
  });

  test("truncates a brief longer than 1200 chars, and result decodes to <=1200 chars ending in ellipsis", () => {
    const longBrief = "B".repeat(1300);
    const url = buildHandoffUrl(longBrief);
    const ideaRaw = extractIdeaParam(url);
    const decoded = decodeURIComponent(ideaRaw);
    assert.ok(decoded.length <= 1200, `expected length <= 1200, got ${decoded.length}`);
    assert.ok(decoded.endsWith("…"));
  });

  test("truncation happens after trimming (long brief with surrounding whitespace)", () => {
    const longBrief = "  " + "C".repeat(1300) + "  ";
    const url = buildHandoffUrl(longBrief);
    const ideaRaw = extractIdeaParam(url);
    const decoded = decodeURIComponent(ideaRaw);
    assert.ok(decoded.length <= 1200);
    assert.ok(!decoded.startsWith(" "));
    assert.ok(decoded.endsWith("…"));
  });

  test("short brief round-trips exactly with no truncation", () => {
    const brief = "Short idea";
    const url = buildHandoffUrl(brief);
    const ideaRaw = extractIdeaParam(url);
    assert.equal(decodeURIComponent(ideaRaw), brief);
    assert.ok(!decodeURIComponent(ideaRaw).endsWith("…"));
  });
});
