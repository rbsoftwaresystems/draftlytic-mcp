/**
 * validate_spec — structural + quality checks on a spec object.
 *
 * Structural issues come from Zod parsing (missing/empty required sections).
 * Quality hints are heuristic and non-blocking: they nudge toward a spec
 * that's actually useful to a coding agent, without hard-failing on style.
 */
import { SpecSchema, type Spec } from "./spec-schema.js";

export interface ValidationIssue {
  /** "error" blocks a clean spec; "hint" is a quality nudge, not a blocker. */
  severity: "error" | "hint";
  path: string;
  message: string;
}

export interface ValidateSpecResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\btbd\b/i,
  /\btodo\b/i,
  /\bfixme\b/i,
  /\blorem ipsum\b/i,
  /\bplaceholder\b/i,
  /\bxxx\b/i,
  /\bfill (this|me) in\b/i,
  /\bwip\b/i,
];

function findPlaceholderText(text: string): string | null {
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(text)) return pattern.source;
  }
  return null;
}

function scanForPlaceholders(spec: Spec, issues: ValidationIssue[]): void {
  const checks: { path: string; text: string | undefined | null }[] = [
    { path: "name", text: spec.name },
    { path: "overview", text: spec.overview },
    { path: "target_audience", text: spec.target_audience },
    { path: "revenue_model", text: spec.revenue_model },
  ];

  (spec.platforms ?? []).forEach((p, i) => {
    checks.push({ path: `platforms[${i}]`, text: p });
  });

  (spec.tech_stack ?? []).forEach((t, i) => {
    checks.push({ path: `tech_stack[${i}]`, text: t });
  });

  spec.features.forEach((f, i) => {
    checks.push({ path: `features[${i}].title`, text: f.title });
    checks.push({ path: `features[${i}].description`, text: f.description });
    (f.acceptance_criteria ?? []).forEach((ac, j) => {
      checks.push({
        path: `features[${i}].acceptance_criteria[${j}]`,
        text: ac,
      });
    });
  });

  (spec.screens ?? []).forEach((s, i) => {
    checks.push({ path: `screens[${i}].name`, text: s.name });
    checks.push({ path: `screens[${i}].purpose`, text: s.purpose });
  });

  (spec.data_model ?? []).forEach((entity, i) => {
    checks.push({ path: `data_model[${i}].entity`, text: entity.entity });
    entity.fields.forEach((field, j) => {
      checks.push({
        path: `data_model[${i}].fields[${j}].name`,
        text: field.name,
      });
      checks.push({
        path: `data_model[${i}].fields[${j}].type`,
        text: field.type,
      });
      checks.push({
        path: `data_model[${i}].fields[${j}].notes`,
        text: field.notes,
      });
    });
  });

  (spec.constraints ?? []).forEach((c, i) => {
    checks.push({ path: `constraints[${i}]`, text: c });
  });

  (spec.non_goals ?? []).forEach((n, i) => {
    checks.push({ path: `non_goals[${i}]`, text: n });
  });

  for (const { path, text } of checks) {
    if (!text) continue;
    const hit = findPlaceholderText(text);
    if (hit) {
      issues.push({
        severity: "error",
        path,
        message: `Looks like placeholder text (matched /${hit}/i) — replace with real content before treating this spec as done.`,
      });
    }
  }
}

function scanQualityHints(spec: Spec, issues: ValidationIssue[]): void {
  const mustHaves = spec.features.filter((f) => f.priority === "must-have");
  const mustHavesWithoutAc = mustHaves.filter(
    (f) => !f.acceptance_criteria || f.acceptance_criteria.length === 0,
  );
  if (mustHaves.length > 0 && mustHavesWithoutAc.length === mustHaves.length) {
    issues.push({
      severity: "hint",
      path: "features",
      message:
        "None of your must-have features have acceptance_criteria. Adding 2-4 short, testable statements per feature gives a coding agent a clear definition of done.",
    });
  }

  if (!spec.non_goals || spec.non_goals.length === 0) {
    issues.push({
      severity: "hint",
      path: "non_goals",
      message:
        'No non_goals listed. Explicitly stating what you\'re NOT building (e.g. "no team/multi-user support in v1") stops a coding agent from over-building.',
    });
  }

  if (!spec.screens || spec.screens.length === 0) {
    issues.push({
      severity: "hint",
      path: "screens",
      message:
        "No screens listed. For anything with a UI, listing the core screens (even 3-5) helps a coding agent scaffold the right structure up front.",
    });
  }

  if (!spec.data_model || spec.data_model.length === 0) {
    issues.push({
      severity: "hint",
      path: "data_model",
      message:
        "No data_model listed. If the project persists anything, sketching the core entities and fields avoids the agent inventing a schema that doesn't match your mental model.",
    });
  }

  if (!spec.constraints || spec.constraints.length === 0) {
    issues.push({
      severity: "hint",
      path: "constraints",
      message:
        'No constraints listed. Budget, timeline, or must-use-tech constraints (e.g. "must run on free-tier Supabase") steer the plan toward something you can actually ship.',
    });
  }

  if (!spec.revenue_model) {
    issues.push({
      severity: "hint",
      path: "revenue_model",
      message:
        "No revenue_model set. Fine for an internal tool or a v1 experiment — worth adding once you know how (or if) this makes money.",
    });
  }

  const niceOrFuture = spec.features.filter((f) => f.priority !== "must-have");
  if (
    spec.features.length > 0 &&
    niceOrFuture.length === spec.features.length
  ) {
    issues.push({
      severity: "hint",
      path: "features",
      message:
        "No feature is marked must-have. Pick the smallest set that makes v1 real — everything else can wait.",
    });
  }
}

export function validateSpec(input: unknown): ValidateSpecResult {
  const issues: ValidationIssue[] = [];
  const parsed = SpecSchema.safeParse(input);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        severity: "error",
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      });
    }
    return { valid: false, issues };
  }

  scanForPlaceholders(parsed.data, issues);
  scanQualityHints(parsed.data, issues);

  const hasErrors = issues.some((i) => i.severity === "error");
  return { valid: !hasErrors, issues };
}
