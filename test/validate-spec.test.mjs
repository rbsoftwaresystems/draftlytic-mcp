import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateSpec } from "../dist/validate-spec.js";
import { validSpec, minimalValidSpec, clone } from "./fixtures.mjs";

describe("validateSpec — happy path", () => {
  test("a fully-populated valid spec has no issues at all", () => {
    const result = validateSpec(validSpec());
    assert.deepEqual(result, { valid: true, issues: [] });
  });

  test("a minimal-but-valid spec is valid:true even though it carries hints", () => {
    const result = validateSpec(minimalValidSpec());
    assert.equal(result.valid, true);
    assert.ok(result.issues.length > 0, "expected quality hints to be present");
    assert.ok(
      result.issues.every((i) => i.severity === "hint"),
      "a spec with only hints must not contain any errors",
    );
  });
});

describe("validateSpec — structural (Zod) errors", () => {
  test("empty object input produces only errors, all severity 'error'", () => {
    const result = validateSpec({});
    assert.equal(result.valid, false);
    assert.ok(result.issues.length > 0);
    assert.ok(result.issues.every((i) => i.severity === "error"));
  });

  test("missing required fields report their field name as the path", () => {
    const result = validateSpec({});
    const paths = result.issues.map((i) => i.path);
    assert.ok(paths.includes("name"));
    assert.ok(paths.includes("overview"));
    assert.ok(paths.includes("target_audience"));
    assert.ok(paths.includes("platforms"));
    assert.ok(paths.includes("tech_stack"));
    assert.ok(paths.includes("features"));
  });

  test("null input falls back to '(root)' as the path", () => {
    const result = validateSpec(null);
    assert.equal(result.valid, false);
    assert.deepEqual(result.issues, [
      {
        severity: "error",
        path: "(root)",
        message: "Invalid input: expected object, received null",
      },
    ]);
  });

  test("non-object primitive input falls back to '(root)' as the path", () => {
    const result = validateSpec("just a string");
    assert.equal(result.valid, false);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].path, "(root)");
    assert.equal(result.issues[0].severity, "error");
  });

  test("empty platforms array trips the min(1) rule with a specific message", () => {
    const spec = clone(validSpec());
    spec.platforms = [];
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.deepEqual(result.issues, [
      {
        severity: "error",
        path: "platforms",
        message: "At least one platform is required",
      },
    ]);
  });

  test("empty features array trips the min(1) rule with a specific message", () => {
    const spec = clone(validSpec());
    spec.features = [];
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.deepEqual(result.issues, [
      {
        severity: "error",
        path: "features",
        message: "At least one feature is required",
      },
    ]);
  });

  test("empty feature title reports a nested dotted path and custom message", () => {
    const spec = clone(validSpec());
    spec.features[0].title = "";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.deepEqual(result.issues, [
      {
        severity: "error",
        path: "features.0.title",
        message: "Feature title cannot be empty",
      },
    ]);
  });

  test("invalid feature priority enum value reports an error", () => {
    const spec = clone(validSpec());
    spec.features[0].priority = "urgent";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].path, "features.0.priority");
    assert.equal(result.issues[0].severity, "error");
  });

  test("structurally-broken spec skips placeholder and quality-hint scans entirely (early return)", () => {
    // This spec is both structurally broken (empty features) AND would,
    // if the Zod parse succeeded, trigger several quality hints (missing
    // screens/data_model/constraints/etc). Confirm ONLY the Zod error(s)
    // come back — no hints, because scanForPlaceholders/scanQualityHints
    // never run when parsing fails.
    const spec = minimalValidSpec();
    spec.features = []; // violates min(1) -> Zod parse fails
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.deepEqual(result.issues, [
      {
        severity: "error",
        path: "features",
        message: "At least one feature is required",
      },
    ]);
  });
});

describe("validateSpec — placeholder detection", () => {
  const cases = [
    { needle: "TBD", pattern: "\\btbd\\b" },
    { needle: "todo", pattern: "\\btodo\\b" },
    { needle: "fixme", pattern: "\\bfixme\\b" },
    { needle: "lorem ipsum", pattern: "\\blorem ipsum\\b" },
    { needle: "placeholder", pattern: "\\bplaceholder\\b" },
    { needle: "xxx", pattern: "\\bxxx\\b" },
    { needle: "fill this in", pattern: "\\bfill (this|me) in\\b" },
    { needle: "fill me in", pattern: "\\bfill (this|me) in\\b" },
    { needle: "wip", pattern: "\\bwip\\b" },
  ];

  for (const { needle, pattern } of cases) {
    test(`detects "${needle}" as placeholder text in a top-level field`, () => {
      const spec = clone(validSpec());
      spec.overview = `Some text with ${needle} inside it.`;
      const result = validateSpec(spec);
      assert.equal(result.valid, false);
      const hit = result.issues.find((i) => i.path === "overview");
      assert.ok(hit, "expected an error on the overview path");
      assert.equal(hit.severity, "error");
      assert.equal(
        hit.message,
        `Looks like placeholder text (matched /${pattern}/i) — replace with real content before treating this spec as done.`,
      );
    });
  }

  test("placeholder detection is case-insensitive (uppercase TBD)", () => {
    const spec = clone(validSpec());
    spec.name = "Project TBD";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.deepEqual(result.issues, [
      {
        severity: "error",
        path: "name",
        message:
          "Looks like placeholder text (matched /\\btbd\\b/i) — replace with real content before treating this spec as done.",
      },
    ]);
  });

  test("placeholder detection is case-insensitive (lowercase tbd)", () => {
    const spec = clone(validSpec());
    spec.name = "Project tbd";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].message.includes("\\btbd\\b"), true);
  });

  test("word boundaries: 'todos' does NOT match the /\\btodo\\b/i pattern", () => {
    const spec = clone(validSpec());
    spec.overview = "Track your todos list here.";
    const result = validateSpec(spec);
    assert.equal(result.valid, true);
    assert.deepEqual(result.issues, []);
  });

  test("word boundaries: 'wiping'/'swipe' do NOT match the /\\bwip\\b/i pattern", () => {
    const spec = clone(validSpec());
    spec.overview = "Users can swipe cards while wiping dust off the screen.";
    const result = validateSpec(spec);
    assert.equal(result.valid, true);
    assert.deepEqual(result.issues, []);
  });

  test("detects placeholder in target_audience", () => {
    const spec = clone(validSpec());
    spec.target_audience = "TBD";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "target_audience");
  });

  test("detects placeholder in revenue_model", () => {
    const spec = clone(validSpec());
    spec.revenue_model = "lorem ipsum dolor";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "revenue_model");
  });

  test("detects placeholder in platforms[i]", () => {
    const spec = clone(validSpec());
    spec.platforms = ["TBD"];
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "platforms[0]");
  });

  test("detects placeholder in tech_stack[i]", () => {
    const spec = clone(validSpec());
    spec.tech_stack = ["placeholder"];
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "tech_stack[0]");
  });

  test("detects placeholder in constraints[i]", () => {
    const spec = clone(validSpec());
    spec.constraints = ["xxx"];
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "constraints[0]");
  });

  test("detects placeholder in non_goals[i]", () => {
    const spec = clone(validSpec());
    spec.non_goals = ["WIP"];
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "non_goals[0]");
  });

  test("detects placeholder in features[i].title", () => {
    const spec = clone(validSpec());
    spec.features[0].title = "TODO feature";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "features[0].title");
  });

  test("detects placeholder in features[i].description", () => {
    const spec = clone(validSpec());
    spec.features[0].description = "fixme description";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "features[0].description");
  });

  test("detects placeholder in features[i].acceptance_criteria[j]", () => {
    const spec = clone(validSpec());
    spec.features[0].acceptance_criteria[0] = "TODO: write this";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "features[0].acceptance_criteria[0]");
  });

  test("detects placeholder in screens[i].name", () => {
    const spec = clone(validSpec());
    spec.screens[0].name = "todo screen";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "screens[0].name");
  });

  test("detects placeholder in screens[i].purpose", () => {
    const spec = clone(validSpec());
    spec.screens[0].purpose = "xxx";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "screens[0].purpose");
  });

  test("detects placeholder in data_model[i].entity", () => {
    const spec = clone(validSpec());
    spec.data_model[0].entity = "TBD entity";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "data_model[0].entity");
  });

  test("detects placeholder in data_model[i].fields[j].name", () => {
    const spec = clone(validSpec());
    spec.data_model[0].fields[0].name = "placeholder";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "data_model[0].fields[0].name");
  });

  test("detects placeholder in data_model[i].fields[j].type", () => {
    const spec = clone(validSpec());
    spec.data_model[0].fields[0].type = "xxx";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "data_model[0].fields[0].type");
  });

  test("detects placeholder in data_model[i].fields[j].notes", () => {
    const spec = clone(validSpec());
    spec.data_model[0].fields[0].notes = "fixme later";
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].path, "data_model[0].fields[0].notes");
  });

  test("multiple simultaneous placeholder hits are all reported", () => {
    const spec = clone(validSpec());
    spec.constraints = ["xxx"];
    spec.non_goals = ["WIP"];
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    const paths = result.issues.map((i) => i.path).sort();
    assert.deepEqual(paths, ["constraints[0]", "non_goals[0]"]);
  });

  test("an empty/undefined text field is skipped, not flagged", () => {
    // revenue_model is optional; when absent there is nothing to scan.
    const spec = clone(validSpec());
    delete spec.revenue_model;
    const result = validateSpec(spec);
    assert.ok(!result.issues.some((i) => i.path === "revenue_model" && i.severity === "error"));
  });
});

describe("validateSpec — quality hints", () => {
  test("validSpec() (everything present) yields zero hints", () => {
    const result = validateSpec(validSpec());
    assert.deepEqual(
      result.issues.filter((i) => i.severity === "hint"),
      [],
    );
  });

  test("hint: no must-have feature has acceptance_criteria (all must-haves lack AC)", () => {
    const spec = clone(validSpec());
    delete spec.features[0].acceptance_criteria;
    const result = validateSpec(spec);
    assert.equal(result.valid, true);
    const hint = result.issues.find(
      (i) =>
        i.path === "features" &&
        i.message.startsWith("None of your must-have features have acceptance_criteria"),
    );
    assert.ok(hint, "expected the must-have-without-AC hint");
    assert.equal(hint.severity, "hint");
  });

  test("no must-have-without-AC hint when at least one must-have has acceptance_criteria", () => {
    // validSpec() has exactly one must-have and it has AC -> no such hint.
    const result = validateSpec(validSpec());
    assert.ok(
      !result.issues.some((i) =>
        i.message.startsWith("None of your must-have features have acceptance_criteria"),
      ),
    );
  });

  test("hint: no non_goals listed", () => {
    const spec = clone(validSpec());
    delete spec.non_goals;
    const result = validateSpec(spec);
    assert.equal(result.valid, true);
    assert.deepEqual(
      result.issues.filter((i) => i.severity === "hint"),
      [
        {
          severity: "hint",
          path: "non_goals",
          message:
            'No non_goals listed. Explicitly stating what you\'re NOT building (e.g. "no team/multi-user support in v1") stops a coding agent from over-building.',
        },
      ],
    );
  });

  test("hint: non_goals present but empty array also triggers the hint", () => {
    const spec = clone(validSpec());
    spec.non_goals = [];
    const result = validateSpec(spec);
    assert.equal(result.valid, true);
    assert.ok(result.issues.some((i) => i.path === "non_goals" && i.severity === "hint"));
  });

  test("hint: no screens listed", () => {
    const spec = clone(validSpec());
    delete spec.screens;
    const result = validateSpec(spec);
    assert.equal(result.valid, true);
    assert.deepEqual(
      result.issues.filter((i) => i.severity === "hint"),
      [
        {
          severity: "hint",
          path: "screens",
          message:
            "No screens listed. For anything with a UI, listing the core screens (even 3-5) helps a coding agent scaffold the right structure up front.",
        },
      ],
    );
  });

  test("hint: no data_model listed", () => {
    const spec = clone(validSpec());
    delete spec.data_model;
    const result = validateSpec(spec);
    assert.equal(result.valid, true);
    assert.deepEqual(
      result.issues.filter((i) => i.severity === "hint"),
      [
        {
          severity: "hint",
          path: "data_model",
          message:
            "No data_model listed. If the project persists anything, sketching the core entities and fields avoids the agent inventing a schema that doesn't match your mental model.",
        },
      ],
    );
  });

  test("hint: no constraints listed", () => {
    const spec = clone(validSpec());
    delete spec.constraints;
    const result = validateSpec(spec);
    assert.equal(result.valid, true);
    assert.deepEqual(
      result.issues.filter((i) => i.severity === "hint"),
      [
        {
          severity: "hint",
          path: "constraints",
          message:
            'No constraints listed. Budget, timeline, or must-use-tech constraints (e.g. "must run on free-tier Supabase") steer the plan toward something you can actually ship.',
        },
      ],
    );
  });

  test("hint: no revenue_model set", () => {
    const spec = clone(validSpec());
    delete spec.revenue_model;
    const result = validateSpec(spec);
    assert.equal(result.valid, true);
    assert.deepEqual(
      result.issues.filter((i) => i.severity === "hint"),
      [
        {
          severity: "hint",
          path: "revenue_model",
          message:
            "No revenue_model set. Fine for an internal tool or a v1 experiment — worth adding once you know how (or if) this makes money.",
        },
      ],
    );
  });

  test("hint: no feature is marked must-have (all nice-to-have/future)", () => {
    const spec = clone(validSpec());
    spec.features.forEach((f) => {
      f.priority = "nice-to-have";
    });
    const result = validateSpec(spec);
    assert.equal(result.valid, true);
    assert.deepEqual(result.issues, [
      {
        severity: "hint",
        path: "features",
        message:
          "No feature is marked must-have. Pick the smallest set that makes v1 real — everything else can wait.",
      },
    ]);
  });

  test("no 'must-have-without-AC' hint fires when there are zero must-haves (guarded by mustHaves.length > 0)", () => {
    const spec = clone(validSpec());
    spec.features.forEach((f) => {
      f.priority = "future";
    });
    const result = validateSpec(spec);
    assert.equal(result.valid, true);
    assert.ok(
      !result.issues.some((i) =>
        i.message.startsWith("None of your must-have features have acceptance_criteria"),
      ),
    );
    // but the "no must-have" hint should be present instead
    assert.ok(
      result.issues.some((i) => i.message.startsWith("No feature is marked must-have")),
    );
  });

  test("minimalValidSpec() triggers exactly the expected set of hints", () => {
    const result = validateSpec(minimalValidSpec());
    assert.equal(result.valid, true);
    const paths = result.issues.map((i) => i.path).sort();
    assert.deepEqual(paths, [
      "constraints",
      "data_model",
      "features",
      "non_goals",
      "revenue_model",
      "screens",
    ]);
    assert.ok(result.issues.every((i) => i.severity === "hint"));
  });

  test("hints and errors can coexist; presence of any error still makes valid:false", () => {
    const spec = clone(validSpec());
    spec.non_goals = []; // triggers a hint
    spec.name = "TBD"; // triggers a placeholder error
    const result = validateSpec(spec);
    assert.equal(result.valid, false);
    const severities = result.issues.map((i) => i.severity).sort();
    assert.deepEqual(severities, ["error", "hint"]);
  });
});
