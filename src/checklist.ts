/**
 * spec_checklist — a fixed, hand-written planning checklist grouped by
 * category. Categories are inspired by the kind of ground a real product
 * spec needs to cover before a coding agent can build from it — not a copy
 * of any Draftlytic question bank, database table, or AI prompt.
 *
 * Each question is an object rather than a bare string so the client can
 * present it as a selectable multiple-choice question instead of forcing the
 * user to type free text:
 *
 *   - `options`     — a short list (<=4, matching the cap on most editor
 *                     question pickers) of suggested answers. Omit it for
 *                     genuinely open questions ("who's your first user?") that
 *                     no fixed list can answer well — those stay free-text.
 *   - `multiSelect` — true when several options can apply at once (e.g. which
 *                     platforms). Only meaningful alongside `options`.
 *
 * There is deliberately no "Other / type your own" option in these lists:
 * MCP clients that render a question picker (e.g. Claude Code) add a
 * free-text escape automatically, so baking one in would double it up. The
 * `spec_checklist` tool description and the `plan_project` prompt tell the
 * client to always leave that escape open.
 */

export interface ChecklistQuestion {
  /** The question text. Always ends with "?". */
  prompt: string;
  /**
   * Suggested selectable answers the client can render as choices. Keep to
   * <=4. Omit entirely for open questions that should stay free-text.
   */
  options?: string[];
  /** True if the user may pick several options. Only used when `options` is set. */
  multiSelect?: boolean;
}

export interface ChecklistCategory {
  category: string;
  label: string;
  questions: ChecklistQuestion[];
}

export const SPEC_CHECKLIST: ChecklistCategory[] = [
  {
    category: "platform",
    label: "Platform",
    questions: [
      {
        prompt:
          "What surfaces does this need to run on — web, iOS, Android, desktop, or some combination?",
        options: ["Web", "iOS", "Android", "Desktop"],
        multiSelect: true,
      },
      {
        prompt:
          "Is this a brand-new build, or does it bolt onto an existing app/codebase?",
        options: ["Brand-new build", "Extends an existing product"],
      },
      {
        prompt:
          "Does it need to work offline, or is an always-online connection fine?",
        options: [
          "Always-online is fine",
          "Offline-first with sync",
          "Must work fully offline",
        ],
      },
    ],
  },
  {
    category: "tech_stack",
    label: "Tech Stack",
    questions: [
      {
        prompt:
          "Any languages or frameworks you already know and want to stick with?",
        options: ["TypeScript / React", "Next.js", "Python", "No preference"],
        multiSelect: true,
      },
      {
        prompt:
          "Do you have a hosting/database preference (e.g. Vercel + Supabase, self-hosted, serverless)?",
        options: [
          "Vercel + Supabase",
          "Serverless (AWS / Cloudflare)",
          "Self-hosted",
          "No preference",
        ],
      },
      {
        prompt:
          "Any third-party APIs this depends on (payments, AI, maps, email)?",
        options: ["Payments", "AI / LLM", "Maps / location", "Email / SMS"],
        multiSelect: true,
      },
    ],
  },
  {
    category: "target_audience",
    label: "Target Audience",
    questions: [
      {
        prompt:
          'Who\'s the first person that would actually use this — be specific, not "everyone"?',
      },
      {
        prompt:
          "Are they technical or non-technical? Does that change how forgiving the UI needs to be?",
        options: ["Technical", "Non-technical", "A mix of both"],
      },
      {
        prompt:
          "Is this for yourself/internal use, or are you shipping it to strangers?",
        options: [
          "Just me",
          "Me + friends / team",
          "Internal / company use",
          "Shipping to strangers",
        ],
      },
    ],
  },
  {
    category: "features",
    label: "Features",
    questions: [
      {
        prompt:
          "What's the one thing this has to do for v1 to be worth shipping at all?",
      },
      {
        prompt: "What can wait for v2 without anyone noticing on day one?",
      },
      {
        prompt:
          "Is there a feature you're tempted to add that's actually scope creep?",
      },
      {
        prompt:
          'For each must-have feature, what does "done" look like — can you state it as a testable checklist?',
      },
    ],
  },
  {
    category: "competitors",
    label: "Competitors",
    questions: [
      {
        prompt:
          "What do people use today instead of this (even a spreadsheet counts)?",
        options: [
          "A spreadsheet / notes",
          "A competitor product",
          "A manual / offline process",
          "Nothing yet",
        ],
      },
      {
        prompt:
          "What's the one thing an existing option gets wrong that you're fixing?",
      },
      {
        prompt:
          "Is there a reason this hasn't already been built well by someone else?",
      },
    ],
  },
  {
    category: "revenue",
    label: "Revenue",
    questions: [
      {
        prompt:
          "Is this free, paid, or free-with-upgrade? If paid, one-time or subscription?",
        options: [
          "Free",
          "One-time purchase",
          "Subscription",
          "Free with paid upgrade",
        ],
      },
      {
        prompt:
          "If you're not sure about monetization yet, is that a deliberate v1 decision?",
        options: ["Yes — deliberately deferred", "No — need to decide"],
      },
      {
        prompt:
          "Any obvious constraint this puts on the build (e.g. needs Stripe/Polar integration)?",
        options: [
          "Needs a payment provider (Stripe / Polar)",
          "Needs subscription billing",
          "No billing in v1",
        ],
      },
    ],
  },
  {
    category: "constraints",
    label: "Constraints",
    questions: [
      {
        prompt: "What's the timeline — is there a deadline that shapes scope?",
        options: [
          "No deadline",
          "A few weeks",
          "A month or two",
          "Hard external deadline",
        ],
      },
      {
        prompt:
          "What's the budget, including any tools/APIs that cost money to run?",
        options: [
          "$0 / free tiers only",
          "Small monthly budget",
          "Funded — cost isn't the blocker",
        ],
      },
      {
        prompt:
          "Anything you explicitly refuse to build in v1 (multi-tenancy, admin panel, mobile app)?",
        options: [
          "Multi-tenancy",
          "Admin panel",
          "Mobile app",
          "Nothing off-limits",
        ],
        multiSelect: true,
      },
    ],
  },
  {
    category: "data_model",
    label: "Data Model",
    questions: [
      {
        prompt:
          'What are the 2-5 core "things" this app tracks (users, posts, orders, etc.)?',
      },
      {
        prompt:
          "For each core thing, what fields actually matter — not every possible field, just the ones v1 needs?",
      },
      {
        prompt:
          "Do any of these things belong to a user, or are they shared/global?",
        options: [
          "Each belongs to a user",
          "Some shared / global",
          "All shared / global",
          "No users yet",
        ],
      },
    ],
  },
  {
    category: "notifications",
    label: "Notifications",
    questions: [
      {
        prompt:
          "Does this need to notify anyone about anything (email, push, in-app)?",
        options: ["Email", "Push", "In-app", "None in v1"],
        multiSelect: true,
      },
      {
        prompt: "If yes — what triggers a notification, and who receives it?",
      },
    ],
  },
  {
    category: "external_services",
    label: "External Services",
    questions: [
      {
        prompt:
          "Does this need auth (and if so, email/password, magic link, OAuth)?",
        options: [
          "No auth in v1",
          "Email + password",
          "Magic link",
          "OAuth (Google / GitHub)",
        ],
      },
      {
        prompt:
          "Any external services beyond auth — payments, email delivery, file storage, analytics?",
        options: ["Payments", "Email delivery", "File storage", "Analytics"],
        multiSelect: true,
      },
      {
        prompt:
          "Is there a service you're assuming exists that you haven't actually confirmed (an API, a data source)?",
      },
    ],
  },
  {
    category: "design_ux",
    label: "Design & UX",
    questions: [
      {
        prompt:
          "Is there an existing product whose look/feel you'd point to as a reference?",
      },
      {
        prompt:
          "What's the first thing a new user should do when they land on this — the one action that matters?",
      },
      {
        prompt:
          "Does this need to feel playful, serious, minimal, or dense-with-information?",
        options: [
          "Playful",
          "Serious / professional",
          "Minimal",
          "Dense with information",
        ],
      },
    ],
  },
];
