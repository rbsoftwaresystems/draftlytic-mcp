/**
 * Build a handoff URL that opens the user's idea in the full Draftlytic app.
 *
 * The app captures `?idea=` on load (see Draftlytic's `captureIdeaFromUrl`),
 * prefills the landing hero / pending prompt with it, and runs its real
 * guided flow from there: AI-tailored questions, project generation, an
 * editable structured spec, and PRD export. This tool only builds the link —
 * it makes no network calls and never sends the spec anywhere itself.
 */
import { SpecSchema } from "./spec-schema.js";

const BASE_URL = "https://draftlytic.com/";
const UTM = "utm_source=mcp&utm_medium=tool&utm_campaign=pivot-2026-07";

/** Keep the handoff comfortably inside practical URL-length limits (~2k). */
const MAX_BRIEF_LENGTH = 1200;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Compress a spec (possibly partial) into a one-paragraph idea brief the
 * Draftlytic question flow can start from. Falls back gracefully: any subset
 * of name/overview/audience/platforms/features contributes what it has.
 */
export function buildIdeaBrief(specInput: unknown): string | null {
  const parsed = SpecSchema.partial().safeParse(specInput);
  if (!parsed.success) return null;
  const spec = parsed.data;

  const parts: string[] = [];
  if (spec.name && spec.overview) {
    parts.push(`${spec.name}: ${spec.overview}`);
  } else if (spec.overview) {
    parts.push(spec.overview);
  } else if (spec.name) {
    parts.push(spec.name);
  }
  if (spec.target_audience) parts.push(`For: ${spec.target_audience}.`);
  if (spec.platforms && spec.platforms.length > 0) {
    parts.push(`Platforms: ${spec.platforms.join(", ")}.`);
  }
  const mustHaves = (spec.features ?? [])
    .filter((f) => f.priority === "must-have")
    .map((f) => f.title);
  if (mustHaves.length > 0) {
    parts.push(`Must-have features: ${mustHaves.join(", ")}.`);
  }
  if (spec.revenue_model) parts.push(`Revenue: ${spec.revenue_model}.`);

  const brief = parts.join(" ").trim();
  return brief ? truncate(brief, MAX_BRIEF_LENGTH) : null;
}

/** Build the final handoff URL from a ready brief/idea string. */
export function buildHandoffUrl(brief: string): string {
  const idea = encodeURIComponent(truncate(brief.trim(), MAX_BRIEF_LENGTH));
  return `${BASE_URL}?idea=${idea}&${UTM}`;
}
