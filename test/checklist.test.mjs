import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { SPEC_CHECKLIST } from "../dist/checklist.js";

const EXPECTED_CATEGORY_KEYS = [
  "platform",
  "tech_stack",
  "target_audience",
  "features",
  "competitors",
  "revenue",
  "constraints",
  "data_model",
  "notifications",
  "external_services",
  "design_ux",
];

describe("SPEC_CHECKLIST shape", () => {
  test("is a non-empty array", () => {
    assert.ok(Array.isArray(SPEC_CHECKLIST));
    assert.ok(SPEC_CHECKLIST.length > 0);
  });

  test("has exactly 11 categories", () => {
    assert.equal(SPEC_CHECKLIST.length, 11);
  });

  test("category keys equal the expected set exactly (order-independent)", () => {
    const actualKeys = SPEC_CHECKLIST.map((c) => c.category);
    assert.deepEqual(
      [...actualKeys].sort(),
      [...EXPECTED_CATEGORY_KEYS].sort(),
    );
  });

  test("category keys match the expected order", () => {
    const actualKeys = SPEC_CHECKLIST.map((c) => c.category);
    assert.deepEqual(actualKeys, EXPECTED_CATEGORY_KEYS);
  });

  test("category keys are unique (no duplicates)", () => {
    const keys = SPEC_CHECKLIST.map((c) => c.category);
    const uniqueKeys = new Set(keys);
    assert.equal(uniqueKeys.size, keys.length);
  });

  test("every entry has a non-empty string category", () => {
    for (const entry of SPEC_CHECKLIST) {
      assert.equal(typeof entry.category, "string");
      assert.ok(entry.category.length > 0, `category "${entry.category}" should be non-empty`);
    }
  });

  test("every entry has a non-empty string label", () => {
    for (const entry of SPEC_CHECKLIST) {
      assert.equal(typeof entry.label, "string", `label for "${entry.category}" should be a string`);
      assert.ok(entry.label.length > 0, `label for "${entry.category}" should be non-empty`);
    }
  });

  test("every entry has a questions array with between 2 and 4 items", () => {
    for (const entry of SPEC_CHECKLIST) {
      assert.ok(Array.isArray(entry.questions), `questions for "${entry.category}" should be an array`);
      assert.ok(
        entry.questions.length >= 2 && entry.questions.length <= 4,
        `questions for "${entry.category}" should have 2-4 items, got ${entry.questions.length}`,
      );
    }
  });

  test("every question is a non-empty string ending with '?'", () => {
    for (const entry of SPEC_CHECKLIST) {
      for (const question of entry.questions) {
        assert.equal(
          typeof question,
          "string",
          `question in "${entry.category}" should be a string`,
        );
        assert.ok(
          question.length > 0,
          `question in "${entry.category}" should be non-empty`,
        );
        assert.ok(
          question.endsWith("?"),
          `question in "${entry.category}" should end with "?": ${JSON.stringify(question)}`,
        );
      }
    }
  });
});

describe("SPEC_CHECKLIST exact question counts per category", () => {
  // Explicit per-category counts, so drift in any single category's
  // question count is caught precisely (not just the general 2-4 bound).
  const EXPECTED_COUNTS = {
    platform: 3,
    tech_stack: 3,
    target_audience: 3,
    features: 4,
    competitors: 3,
    revenue: 3,
    constraints: 3,
    data_model: 3,
    notifications: 2,
    external_services: 3,
    design_ux: 3,
  };

  for (const [category, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
    test(`"${category}" has exactly ${expectedCount} questions`, () => {
      const entry = SPEC_CHECKLIST.find((c) => c.category === category);
      assert.ok(entry, `expected a "${category}" category to exist`);
      assert.equal(entry.questions.length, expectedCount);
    });
  }
});

describe("SPEC_CHECKLIST labels", () => {
  const EXPECTED_LABELS = {
    platform: "Platform",
    tech_stack: "Tech Stack",
    target_audience: "Target Audience",
    features: "Features",
    competitors: "Competitors",
    revenue: "Revenue",
    constraints: "Constraints",
    data_model: "Data Model",
    notifications: "Notifications",
    external_services: "External Services",
    design_ux: "Design & UX",
  };

  for (const [category, expectedLabel] of Object.entries(EXPECTED_LABELS)) {
    test(`"${category}" has label "${expectedLabel}"`, () => {
      const entry = SPEC_CHECKLIST.find((c) => c.category === category);
      assert.ok(entry, `expected a "${category}" category to exist`);
      assert.equal(entry.label, expectedLabel);
    });
  }
});
