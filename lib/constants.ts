// Shared lists. Add a business, path or video mode here and the whole app picks it up.

export const BUSINESSES = [
  "Seed Loop", "Persona Mall", "Tool Bazaar", "BuildBot", "BuildBot 2", "Cooking app", "Caelia",
  "QuantVantage", "Designing app", "Unique Boutique", "QVTrellis builds", "Responsible AI Check",
  "Other mall store", "Undecided",
];

export type Path = { id: string; name: string; hint: string };
export const PATHS: Path[] = [
  { id: "client", name: "High-stakes client / business", hint: "Ads that pay back. Marketing app tiers or done-for-you." },
  { id: "builder", name: "Builder with an idea", hint: "Seed Loop: test apps, earn points, get yours built." },
  { id: "creator", name: "Creator", hint: "Paid video and ad work for mall businesses." },
  { id: "appuser", name: "App user", hint: "Find AI tools in the mall." },
  { id: "entre", name: "Entrepreneur / founder / tech founder", hint: "Learn and grow every part of the business." },
  { id: "build", name: "QVTrellis build", hint: "Build it yourself, done for you, or white label." },
  { id: "rai", name: "Responsible AI Check", hint: "Safety pre-test before official certification." },
  { id: "undecided", name: "Undecided", hint: "Show me everything." },
];

export const SOURCES = ["Seed Loop member", "PushPilot affiliate", "Creator", "Client referral", "AI-scaled ad", "Direct"];
export const STAGES = ["New", "Nurture", "Booked", "Won", "Lost"] as const;
export type Stage = (typeof STAGES)[number];

// Video modes are plug-in slots: add one here without touching the others.
export const VIDEO_MODES = [
  { id: "none", label: "No video", hint: "Text script only" },
  { id: "photo", label: "Your photo", hint: "Your face or one you have consent for" },
  { id: "describe", label: "Describe it", hint: "You describe, AI builds it" },
  { id: "pro", label: "One-click pro", hint: "Fully scripted commercial" },
];

export const CONTENT_FORMATS = [
  "30-second ad / commercial", "Funnel video (VSL)", "Social post", "Nurture email", "SMS follow-up", "Booking-call opener",
];

export const PLUGINS = [
  { name: "Payments", detail: "Stripe: subscriptions, yearly plans, payment plans, creator payouts", env: "STRIPE_SECRET_KEY" },
  { name: "Text and AI phone", detail: "Twilio: SMS and voice follow-up to consenting leads", env: "TWILIO_AUTH_TOKEN" },
  { name: "Email sending", detail: "Resend: nurture emails with unsubscribe", env: "RESEND_API_KEY" },
  { name: "AI video", detail: "Video generation API for photo, describe and one-click modes", env: "VIDEO_API_KEY" },
  { name: "Social posting", detail: "Post ads to Facebook, LinkedIn and more", env: "SOCIAL_API_KEY" },
  { name: "Calendar sync", detail: "Google Calendar or Cal.com for bookings and webinars", env: "CALENDAR_API_KEY" },
  { name: "E-signature", detail: "Agreements signed before onboarding", env: "ESIGN_API_KEY" },
];

export const LEVELS = [
  ["PushPilot affiliate", "Share links and ready-made ads. Earn per referral. No funnel training."],
  ["Creator", "Make ads and videos for mall businesses. Paid per piece."],
  ["Seed Loop member", "Test apps for points, push marketing, learn the funnel step by step."],
  ["Entrepreneur", "Run your own campaigns, full funnel access, webinars."],
  ["Founder", "Everything above plus one-on-one strategy and guest spots."],
  ["Tech founder", "Everything above plus builds into the mall and white label."],
  ["Paying client", "Trellis Reach tiers: ads first, then email and phone, then the full system."],
];

export const PROFILE_SLOTS: [string, string][] = [
  ["business_name", "Business"], ["app", "Which mall business"], ["audience", "Who it's for"],
  ["problem", "Their problem"], ["result", "Result they get"], ["proof", "Proof"],
  ["offer", "Offer"], ["cta", "Call to action"], ["mood", "Look and mood"],
];
