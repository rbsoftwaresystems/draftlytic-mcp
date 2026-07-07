import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SpecSchema,
  FeatureSchema,
  ScreenSchema,
  DataModelFieldSchema,
  DataModelEntitySchema,
  FeaturePrioritySchema,
  specJsonSchemaDescription,
} from "../dist/spec-schema.js";
import { validSpec, minimalValidSpec, clone } from "./fixtures.mjs";

/** Find the issue whose path matches (order-insensitive on trailing indices). */
function issueAt(issues, path) {
  return issues.find((i) => JSON.stringify(i.path) === JSON.stringify(path));
}

describe("SpecSchema - happy paths", () => {
  test("a fully-populated valid spec passes", () => {
    const result = SpecSchema.safeParse(validSpec());
    assert.equal(result.success, true);
  });

  test("a minimal valid spec (only required fields) passes", () => {
    const result = SpecSchema.safeParse(minimalValidSpec());
    assert.equal(result.success, true);
  });

  test("tech_stack may be an empty array", () => {
    const spec = clone(minimalValidSpec());
    spec.tech_stack = [];
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, true);
  });

  test("optional fields (screens, data_model, constraints, non_goals, revenue_model) can be omitted", () => {
    const spec = clone(minimalValidSpec());
    delete spec.screens;
    delete spec.data_model;
    delete spec.constraints;
    delete spec.non_goals;
    delete spec.revenue_model;
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, true);
    assert.equal(result.data.screens, undefined);
    assert.equal(result.data.data_model, undefined);
    assert.equal(result.data.constraints, undefined);
    assert.equal(result.data.non_goals, undefined);
    assert.equal(result.data.revenue_model, undefined);
  });
});

describe("SpecSchema - required field violations (empty string) surface custom messages", () => {
  test("empty name fails with 'Project name cannot be empty'", () => {
    const spec = clone(minimalValidSpec());
    spec.name = "";
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["name"]);
    assert.ok(issue, "expected an issue on path 'name'");
    assert.equal(issue.message, "Project name cannot be empty");
  });

  test("empty overview fails with 'Overview cannot be empty'", () => {
    const spec = clone(minimalValidSpec());
    spec.overview = "";
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["overview"]);
    assert.ok(issue);
    assert.equal(issue.message, "Overview cannot be empty");
  });

  test("empty target_audience fails with 'Target audience cannot be empty'", () => {
    const spec = clone(minimalValidSpec());
    spec.target_audience = "";
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["target_audience"]);
    assert.ok(issue);
    assert.equal(issue.message, "Target audience cannot be empty");
  });

  test("empty platforms array fails with 'At least one platform is required'", () => {
    const spec = clone(minimalValidSpec());
    spec.platforms = [];
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["platforms"]);
    assert.ok(issue);
    assert.equal(issue.message, "At least one platform is required");
  });

  test("empty features array fails with 'At least one feature is required'", () => {
    const spec = clone(minimalValidSpec());
    spec.features = [];
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["features"]);
    assert.ok(issue);
    assert.equal(issue.message, "At least one feature is required");
  });

  test("missing name/overview/target_audience/platforms/features entirely fails validation", () => {
    const result = SpecSchema.safeParse({});
    assert.equal(result.success, false);
    const paths = result.error.issues.map((i) => i.path[0]);
    for (const field of [
      "name",
      "overview",
      "target_audience",
      "platforms",
      "features",
    ]) {
      assert.ok(
        paths.includes(field),
        `expected a validation issue for missing '${field}'`,
      );
    }
  });

  test("all required-field violations are reported together in one safeParse", () => {
    const spec = {
      name: "",
      overview: "",
      target_audience: "",
      platforms: [],
      tech_stack: [],
      features: [],
    };
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, false);
    assert.equal(result.error.issues.length, 5);
    const messages = result.error.issues.map((i) => i.message).sort();
    assert.deepEqual(messages.sort(), [
      "At least one feature is required",
      "At least one platform is required",
      "Overview cannot be empty",
      "Project name cannot be empty",
      "Target audience cannot be empty",
    ]);
  });

  test("a platform entry that is an empty string fails (array item min length)", () => {
    const spec = clone(minimalValidSpec());
    spec.platforms = [""];
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["platforms", 0]);
    assert.ok(issue);
  });
});

describe("SpecSchema - feature priority validation", () => {
  test("an invalid feature priority makes SpecSchema fail", () => {
    const spec = clone(minimalValidSpec());
    spec.features[0].priority = "urgent";
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["features", 0, "priority"]);
    assert.ok(issue, "expected an issue on features[0].priority");
  });

  test("each valid priority value is accepted within a full spec", () => {
    for (const priority of ["must-have", "nice-to-have", "future"]) {
      const spec = clone(minimalValidSpec());
      spec.features[0].priority = priority;
      const result = SpecSchema.safeParse(spec);
      assert.equal(result.success, true, `expected '${priority}' to be valid`);
    }
  });
});

describe("FeaturePrioritySchema", () => {
  test("accepts 'must-have'", () => {
    assert.equal(FeaturePrioritySchema.safeParse("must-have").success, true);
  });

  test("accepts 'nice-to-have'", () => {
    assert.equal(FeaturePrioritySchema.safeParse("nice-to-have").success, true);
  });

  test("accepts 'future'", () => {
    assert.equal(FeaturePrioritySchema.safeParse("future").success, true);
  });

  test("rejects an arbitrary string", () => {
    const result = FeaturePrioritySchema.safeParse("urgent");
    assert.equal(result.success, false);
  });

  test("rejects an empty string", () => {
    assert.equal(FeaturePrioritySchema.safeParse("").success, false);
  });

  test("rejects undefined", () => {
    assert.equal(FeaturePrioritySchema.safeParse(undefined).success, false);
  });

  test("rejects a non-string value", () => {
    assert.equal(FeaturePrioritySchema.safeParse(1).success, false);
  });
});

describe("FeatureSchema", () => {
  const base = { title: "A feature", description: "Does something", priority: "must-have" };

  test("valid minimal feature (no acceptance_criteria) passes", () => {
    const result = FeatureSchema.safeParse(base);
    assert.equal(result.success, true);
    assert.equal(result.data.acceptance_criteria, undefined);
  });

  test("empty title fails with 'Feature title cannot be empty'", () => {
    const result = FeatureSchema.safeParse({ ...base, title: "" });
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["title"]);
    assert.ok(issue);
    assert.equal(issue.message, "Feature title cannot be empty");
  });

  test("empty description fails with 'Feature description cannot be empty'", () => {
    const result = FeatureSchema.safeParse({ ...base, description: "" });
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["description"]);
    assert.ok(issue);
    assert.equal(issue.message, "Feature description cannot be empty");
  });

  test("acceptance_criteria is optional and may be omitted", () => {
    const result = FeatureSchema.safeParse(base);
    assert.equal(result.success, true);
  });

  test("acceptance_criteria as a populated array of non-empty strings passes", () => {
    const result = FeatureSchema.safeParse({
      ...base,
      acceptance_criteria: ["Criterion one", "Criterion two"],
    });
    assert.equal(result.success, true);
    assert.deepEqual(result.data.acceptance_criteria, [
      "Criterion one",
      "Criterion two",
    ]);
  });

  test("acceptance_criteria as an empty array passes (array itself has no min)", () => {
    const result = FeatureSchema.safeParse({ ...base, acceptance_criteria: [] });
    assert.equal(result.success, true);
  });

  test("acceptance_criteria containing an empty string element fails", () => {
    const result = FeatureSchema.safeParse({
      ...base,
      acceptance_criteria: ["Valid one", ""],
    });
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["acceptance_criteria", 1]);
    assert.ok(issue, "expected an issue on acceptance_criteria[1]");
  });

  test("missing priority fails", () => {
    const { priority, ...rest } = base;
    const result = FeatureSchema.safeParse(rest);
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["priority"]);
    assert.ok(issue);
  });
});

describe("ScreenSchema", () => {
  test("a valid screen passes", () => {
    const result = ScreenSchema.safeParse({ name: "Home", purpose: "Landing page" });
    assert.equal(result.success, true);
  });

  test("empty name fails with 'Screen name cannot be empty'", () => {
    const result = ScreenSchema.safeParse({ name: "", purpose: "Landing page" });
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["name"]);
    assert.ok(issue);
    assert.equal(issue.message, "Screen name cannot be empty");
  });

  test("empty purpose fails with 'Screen purpose cannot be empty'", () => {
    const result = ScreenSchema.safeParse({ name: "Home", purpose: "" });
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["purpose"]);
    assert.ok(issue);
    assert.equal(issue.message, "Screen purpose cannot be empty");
  });

  test("both name and purpose empty reports both custom messages", () => {
    const result = ScreenSchema.safeParse({ name: "", purpose: "" });
    assert.equal(result.success, false);
    const messages = result.error.issues.map((i) => i.message).sort();
    assert.deepEqual(messages, [
      "Screen name cannot be empty",
      "Screen purpose cannot be empty",
    ]);
  });

  test("missing name and purpose fails", () => {
    const result = ScreenSchema.safeParse({});
    assert.equal(result.success, false);
    const paths = result.error.issues.map((i) => i.path[0]);
    assert.ok(paths.includes("name"));
    assert.ok(paths.includes("purpose"));
  });
});

describe("DataModelFieldSchema", () => {
  test("a valid field with notes passes", () => {
    const result = DataModelFieldSchema.safeParse({
      name: "id",
      type: "uuid",
      notes: "primary key",
    });
    assert.equal(result.success, true);
  });

  test("notes is optional and may be omitted", () => {
    const result = DataModelFieldSchema.safeParse({ name: "id", type: "uuid" });
    assert.equal(result.success, true);
    assert.equal(result.data.notes, undefined);
  });

  test("empty name fails with 'Field name cannot be empty'", () => {
    const result = DataModelFieldSchema.safeParse({ name: "", type: "uuid" });
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["name"]);
    assert.ok(issue);
    assert.equal(issue.message, "Field name cannot be empty");
  });

  test("empty type fails with 'Field type cannot be empty'", () => {
    const result = DataModelFieldSchema.safeParse({ name: "id", type: "" });
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["type"]);
    assert.ok(issue);
    assert.equal(issue.message, "Field type cannot be empty");
  });
});

describe("DataModelEntitySchema", () => {
  test("a valid entity with fields passes", () => {
    const result = DataModelEntitySchema.safeParse({
      entity: "Card",
      fields: [{ name: "id", type: "uuid" }],
    });
    assert.equal(result.success, true);
  });

  test("an empty fields array is allowed", () => {
    const result = DataModelEntitySchema.safeParse({ entity: "Card", fields: [] });
    assert.equal(result.success, true);
    assert.deepEqual(result.data.fields, []);
  });

  test("empty entity name fails with 'Entity name cannot be empty'", () => {
    const result = DataModelEntitySchema.safeParse({ entity: "", fields: [] });
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["entity"]);
    assert.ok(issue);
    assert.equal(issue.message, "Entity name cannot be empty");
  });

  test("missing fields array fails", () => {
    const result = DataModelEntitySchema.safeParse({ entity: "Card" });
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["fields"]);
    assert.ok(issue);
  });

  test("an invalid nested field surfaces a path into fields[]", () => {
    const result = DataModelEntitySchema.safeParse({
      entity: "Card",
      fields: [{ name: "", type: "uuid" }],
    });
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["fields", 0, "name"]);
    assert.ok(issue);
    assert.equal(issue.message, "Field name cannot be empty");
  });
});

describe("SpecSchema - optional nested arrays wire through the child schemas", () => {
  test("a spec with screens, data_model, constraints, non_goals, revenue_model all populated passes", () => {
    const result = SpecSchema.safeParse(validSpec());
    assert.equal(result.success, true);
    assert.equal(result.data.screens.length, 2);
    assert.equal(result.data.data_model.length, 2);
    assert.equal(result.data.constraints.length, 1);
    assert.equal(result.data.non_goals.length, 1);
    assert.equal(typeof result.data.revenue_model, "string");
  });

  test("an invalid screen inside a full spec surfaces a nested path", () => {
    const spec = clone(validSpec());
    spec.screens[1].purpose = "";
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["screens", 1, "purpose"]);
    assert.ok(issue);
    assert.equal(issue.message, "Screen purpose cannot be empty");
  });

  test("an invalid data_model entity inside a full spec surfaces a nested path", () => {
    const spec = clone(validSpec());
    spec.data_model[0].fields[0].type = "";
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, [
      "data_model",
      0,
      "fields",
      0,
      "type",
    ]);
    assert.ok(issue);
    assert.equal(issue.message, "Field type cannot be empty");
  });

  test("a constraints entry that is an empty string fails", () => {
    const spec = clone(validSpec());
    spec.constraints = [""];
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["constraints", 0]);
    assert.ok(issue);
  });

  test("a non_goals entry that is an empty string fails", () => {
    const spec = clone(validSpec());
    spec.non_goals = [""];
    const result = SpecSchema.safeParse(spec);
    assert.equal(result.success, false);
    const issue = issueAt(result.error.issues, ["non_goals", 0]);
    assert.ok(issue);
  });
});

describe("specJsonSchemaDescription", () => {
  test("is a non-empty string", () => {
    assert.equal(typeof specJsonSchemaDescription, "string");
    assert.ok(specJsonSchemaDescription.length > 0);
  });

  test("mentions the key top-level field names", () => {
    for (const field of ["name", "overview", "target_audience", "platforms", "tech_stack", "features"]) {
      assert.ok(
        specJsonSchemaDescription.includes(field),
        `expected description to mention '${field}'`,
      );
    }
  });

  test("mentions all three feature priority values", () => {
    for (const priority of ["must-have", "nice-to-have", "future"]) {
      assert.ok(
        specJsonSchemaDescription.includes(priority),
        `expected description to mention priority '${priority}'`,
      );
    }
  });

  test("mentions the optional section names", () => {
    for (const field of ["screens", "data_model", "constraints", "non_goals", "revenue_model"]) {
      assert.ok(
        specJsonSchemaDescription.includes(field),
        `expected description to mention '${field}'`,
      );
    }
  });
});
