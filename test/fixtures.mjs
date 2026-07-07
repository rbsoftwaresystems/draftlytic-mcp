/**
 * Shared test fixtures.
 *
 * Tests import from the compiled `dist/` output (same convention as
 * scripts/smoke.mjs) — run `npm run build` before `node --test`.
 */

/**
 * A fully-populated, valid spec that produces ZERO validation issues
 * (no structural errors, no placeholder hits, and no quality hints).
 *
 * Every field is present and every quality-hint condition is satisfied:
 * a must-have feature with acceptance_criteria, plus non_goals, screens,
 * data_model, constraints, and revenue_model. Deep-clone it and delete
 * pieces to trigger specific errors/hints in a test.
 */
export function validSpec() {
  return {
    name: "TaskFlow",
    overview:
      "A lightweight kanban board for solo developers to track side projects.",
    target_audience: "Indie developers juggling multiple side projects.",
    platforms: ["web"],
    tech_stack: ["TypeScript", "React", "Supabase"],
    features: [
      {
        title: "Drag-and-drop board",
        description: "Move cards between columns to update status.",
        priority: "must-have",
        acceptance_criteria: [
          "Cards can be dragged between columns",
          "Column order persists across reloads",
        ],
      },
      {
        title: "Dark mode",
        description: "A dark theme toggle for late-night work.",
        priority: "nice-to-have",
      },
      {
        title: "Mobile app",
        description: "A native companion app.",
        priority: "future",
      },
    ],
    screens: [
      { name: "Board", purpose: "The main kanban view with columns." },
      { name: "Settings", purpose: "Theme and account preferences." },
    ],
    data_model: [
      {
        entity: "Card",
        fields: [
          { name: "id", type: "uuid", notes: "primary key" },
          { name: "title", type: "text" },
          { name: "column_id", type: "uuid", notes: "foreign key to Column" },
        ],
      },
      {
        entity: "Column",
        fields: [{ name: "id", type: "uuid" }],
      },
    ],
    constraints: ["Must run on free-tier Supabase."],
    non_goals: ["No team or multi-user support in v1."],
    revenue_model: "Free with a paid pro tier for unlimited boards.",
  };
}

/** Deep clone via structured JSON round-trip (fixtures are plain JSON). */
export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * The minimal spec that still passes SpecSchema (only required fields).
 * Required: name, overview, target_audience, platforms[>=1], tech_stack[],
 * features[>=1]. This is valid but intentionally triggers quality hints.
 */
export function minimalValidSpec() {
  return {
    name: "Minimal",
    overview: "A tiny valid spec.",
    target_audience: "Testers.",
    platforms: ["web"],
    tech_stack: [],
    features: [
      {
        title: "Core thing",
        description: "Does the one core thing.",
        priority: "must-have",
      },
    ],
  };
}
