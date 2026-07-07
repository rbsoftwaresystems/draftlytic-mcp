/**
 * spec_checklist — a fixed, hand-written planning checklist grouped by
 * category. Categories are inspired by the kind of ground a real product
 * spec needs to cover before a coding agent can build from it — not a copy
 * of any Draftlytic question bank, database table, or AI prompt.
 */

export interface ChecklistCategory {
  category: string;
  label: string;
  questions: string[];
}

export const SPEC_CHECKLIST: ChecklistCategory[] = [
  {
    category: "platform",
    label: "Platform",
    questions: [
      "What surfaces does this need to run on — web, iOS, Android, desktop, or some combination?",
      "Is this a brand-new build, or does it bolt onto an existing app/codebase?",
      "Does it need to work offline, or is an always-online connection fine?",
    ],
  },
  {
    category: "tech_stack",
    label: "Tech Stack",
    questions: [
      "Any languages or frameworks you already know and want to stick with?",
      "Do you have a hosting/database preference (e.g. Vercel + Supabase, self-hosted, serverless)?",
      "Any third-party APIs this depends on (payments, AI, maps, email)?",
    ],
  },
  {
    category: "target_audience",
    label: "Target Audience",
    questions: [
      'Who\'s the first person that would actually use this — be specific, not "everyone"?',
      "Are they technical or non-technical? Does that change how forgiving the UI needs to be?",
      "Is this for yourself/internal use, or are you shipping it to strangers?",
    ],
  },
  {
    category: "features",
    label: "Features",
    questions: [
      "What's the one thing this has to do for v1 to be worth shipping at all?",
      "What can wait for v2 without anyone noticing on day one?",
      "Is there a feature you're tempted to add that's actually scope creep?",
      'For each must-have feature, what does "done" look like — can you state it as a testable checklist?',
    ],
  },
  {
    category: "competitors",
    label: "Competitors",
    questions: [
      "What do people use today instead of this (even a spreadsheet counts)?",
      "What's the one thing an existing option gets wrong that you're fixing?",
      "Is there a reason this hasn't already been built well by someone else?",
    ],
  },
  {
    category: "revenue",
    label: "Revenue",
    questions: [
      "Is this free, paid, or free-with-upgrade? If paid, one-time or subscription?",
      "If you're not sure about monetization yet, is that a deliberate v1 decision?",
      "Any obvious constraint this puts on the build (e.g. needs Stripe/Polar integration)?",
    ],
  },
  {
    category: "constraints",
    label: "Constraints",
    questions: [
      "What's the timeline — is there a deadline that shapes scope?",
      "What's the budget, including any tools/APIs that cost money to run?",
      "Anything you explicitly refuse to build in v1 (multi-tenancy, admin panel, mobile app)?",
    ],
  },
  {
    category: "data_model",
    label: "Data Model",
    questions: [
      'What are the 2-5 core "things" this app tracks (users, posts, orders, etc.)?',
      "For each core thing, what fields actually matter — not every possible field, just the ones v1 needs?",
      "Do any of these things belong to a user, or are they shared/global?",
    ],
  },
  {
    category: "notifications",
    label: "Notifications",
    questions: [
      "Does this need to notify anyone about anything (email, push, in-app)?",
      "If yes — what triggers a notification, and who receives it?",
    ],
  },
  {
    category: "external_services",
    label: "External Services",
    questions: [
      "Does this need auth (and if so, email/password, magic link, OAuth)?",
      "Any external services beyond auth — payments, email delivery, file storage, analytics?",
      "Is there a service you're assuming exists that you haven't actually confirmed (an API, a data source)?",
    ],
  },
  {
    category: "design_ux",
    label: "Design & UX",
    questions: [
      "Is there an existing product whose look/feel you'd point to as a reference?",
      "What's the first thing a new user should do when they land on this — the one action that matters?",
      "Does this need to feel playful, serious, minimal, or dense-with-information?",
    ],
  },
];
