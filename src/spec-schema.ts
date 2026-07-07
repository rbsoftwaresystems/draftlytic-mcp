/**
 * The spec shape draftlytic-mcp works with.
 *
 * This is a deliberately narrow, hand-written schema — NOT a copy of any
 * Draftlytic app type. It borrows section naming and grouping conventions
 * (features grouped by priority, screens vs. data model vs. constraints as
 * separate concerns) from how Draftlytic structures a PRD, so a spec drafted
 * here reads like one exported from the full app. But it has no dependency
 * on Draftlytic's database schema, its AI tool schemas, or its internal
 * types — it's a standalone contract for local spec authoring.
 */
import { z } from "zod";

export const FeaturePrioritySchema = z.enum([
  "must-have",
  "nice-to-have",
  "future",
]);

export type FeaturePriority = z.infer<typeof FeaturePrioritySchema>;

export const FeatureSchema = z.object({
  title: z.string().min(1, "Feature title cannot be empty"),
  description: z.string().min(1, "Feature description cannot be empty"),
  priority: FeaturePrioritySchema,
  acceptance_criteria: z.array(z.string().min(1)).optional(),
});

export type Feature = z.infer<typeof FeatureSchema>;

export const ScreenSchema = z.object({
  name: z.string().min(1, "Screen name cannot be empty"),
  purpose: z.string().min(1, "Screen purpose cannot be empty"),
});

export type Screen = z.infer<typeof ScreenSchema>;

export const DataModelFieldSchema = z.object({
  name: z.string().min(1, "Field name cannot be empty"),
  type: z.string().min(1, "Field type cannot be empty"),
  notes: z.string().optional(),
});

export type DataModelField = z.infer<typeof DataModelFieldSchema>;

export const DataModelEntitySchema = z.object({
  entity: z.string().min(1, "Entity name cannot be empty"),
  fields: z.array(DataModelFieldSchema),
});

export type DataModelEntity = z.infer<typeof DataModelEntitySchema>;

export const SpecSchema = z.object({
  name: z.string().min(1, "Project name cannot be empty"),
  overview: z.string().min(1, "Overview cannot be empty"),
  target_audience: z.string().min(1, "Target audience cannot be empty"),
  platforms: z
    .array(z.string().min(1))
    .min(1, "At least one platform is required"),
  tech_stack: z.array(z.string().min(1)),
  features: z.array(FeatureSchema).min(1, "At least one feature is required"),
  screens: z.array(ScreenSchema).optional(),
  data_model: z.array(DataModelEntitySchema).optional(),
  constraints: z.array(z.string().min(1)).optional(),
  non_goals: z.array(z.string().min(1)).optional(),
  revenue_model: z.string().optional(),
});

export type Spec = z.infer<typeof SpecSchema>;

/** Raw JSON-Schema shape handed to MCP tool inputs (kept in sync with SpecSchema by hand). */
export const specJsonSchemaDescription =
  "A project spec: name, overview, target_audience, platforms[], tech_stack[], " +
  "features[] ({title, description, priority: must-have|nice-to-have|future, acceptance_criteria?[]}), " +
  "screens[]? ({name, purpose}), data_model[]? ({entity, fields[]: {name, type, notes?}}), " +
  "constraints[]?, non_goals[]?, revenue_model?.";
