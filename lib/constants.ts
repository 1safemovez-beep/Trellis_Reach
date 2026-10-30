// Shared lists. Add a business, path or video mode here and the whole app picks it up.

export const BUSINESSES = [
  "Trellis Reach", "Hivecast", "PushPilot", "Seed Loop", "Persona Mall", "Tool Bazaar", "BuildBot 2", "BuildBot App Studio", "Alicia's Art AI Studio", "Cooking app", "AngelzPulse",
  "QuantVantage", "QuantVantage AI Evaluation", "Designing app", "Unique Boutique", "Responsible AI Check",
  "Other mall store", "Undecided",
];

export type Path = { id: string; name: string; hint: string };
export const PATHS: Path[] = [
  { id: "client", name: "High-stakes client / business", hint: "Ads that pay back. Marketing app tiers or done-for-you." },
  { id: "builder", name: "Builder with an idea", hint: "Seed Loop: test apps, earn points, learn real skills like cybersecurity and AI-rules readiness, and get yours built." },
  { id: "creator", name: "Creator", hint: "Paid video and ad work for mall businesses." },
  { id: "appuser", name: "App user", hint: "Find AI tools in the mall." },
  { id: "entre", name: "Entrepreneur / founder / tech founder", hint: "Learn and grow every part of the business." },
  { id: "build", name: "QVTrellis build", hint: "Build it yourself, done for you, or white label." },
  { id: "rai", name: "Responsible AI Check", hint: "Safety pre-test before official certification." },
  { id: "ready", name: "Cyber & AI rules readiness", hint: "Get ready for CMMC and new AI laws before they hit. We test your setup and help you fix gaps before your official assessment." },
  { id: "undecided", name: "Undecided", hint: "Show me everything." },
];

export const SOURCES = ["Seed Loop member", "PushPilot affiliate", "Creator", "Client referral", "AI-scaled ad", "Direct"];
export const STAGES = ["New", "Nurture", "Booked", "Won", "Lost"] as const;
export type Stage = (typeof STAGES)[number];

// Video modes are plug-in slots: add one here without touching the others.
export const VIDEO_MODES = [
  { id: "none", label: "📝 Words only", hint: "No video" },
  { id: "photo", label: "🤳 My photo", hint: "Upload a photo" },
  { id: "describe", label: "🗣️ Describe it", hint: "Say what you want" },
  { id: "pro", label: "⚡ One tap", hint: "AI does it all" },
];

export const CONTENT_FORMATS = [
  "30-second ad / commercial", "Funnel video (VSL)", "Social post", "Nurture email", "SMS follow-up", "Booking-call opener",
  "Designed image ad", "Self-film video script", "Creator brief",
  "Client outreach message (attract clients)", "App user invite (attract users)", "Sales call script (close the deal)",
  "Objection answers", "Proposal / offer close email",
];

// Extra direction for the sales formats, so each one does its job.
export const SALES_GUIDES: Record<string, string> = {
  "Client outreach message (attract clients)": "A short, personal first message (DM or email) to a business owner. Lead with a specific problem they likely have, one line on how we fix it, and a low-pressure question that invites a reply. Under 120 words. Include a 2-message follow-up sequence.",
  "App user invite (attract users)": "An invite that makes a regular person want to try the app today: the everyday problem, what they get in the first 5 minutes, that it is free to start, and one tap to join. Include a short version for social and a longer one for email.",
  "Sales call script (close the deal)": "A full booking-call script for the closer: warm open, permission, discovery questions (situation, pain, cost of doing nothing, goal, decision maker, budget, timeline), recap in their words, present the right tier, handle the top objections, a clear ask for the sale, and next steps. Label each part. Mark where the closer pauses and listens.",
  "Objection answers": "The 8 most likely objections (price, timing, trust, 'I'll think about it', 'I can do it myself', spouse/partner, past bad agency, 'send me info') each with an honest acknowledge, a clarifying question, and a short answer that leads back to the next step.",
  "Proposal / offer close email": "A follow-up email after a call: recap their goal in their words, the recommended package and what's included, the price options (monthly, yearly, payment plan) as placeholders in [brackets], what happens in the first 7 days, and one clear way to say yes.",
};

export const PLUGINS: { name: string; detail: string; env: string; alt?: string[] }[] = [
  { name: "Payments", detail: "Stripe: subscriptions, yearly plans, payment plans, creator payouts", env: "STRIPE_SECRET_KEY" },
  { name: "Text and AI phone", detail: "Twilio: SMS and voice follow-up to consenting leads", env: "TWILIO_AUTH_TOKEN" },
  { name: "Email sending", detail: "Resend: nurture emails with unsubscribe", env: "RESEND_API_KEY" },
  { name: "AI video", detail: "HeyGen: avatar videos read word for word from your script", env: "HEYGEN_API_KEY", alt: ["VIDEO_API_KEY"] },
  { name: "Social posting", detail: "Post ads to Facebook, LinkedIn and more", env: "SOCIAL_API_KEY" },
  { name: "Calendar sync", detail: "Google Calendar or Cal.com for bookings and webinars", env: "CALENDAR_API_KEY" },
  { name: "E-signature", detail: "Agreements signed before onboarding", env: "ESIGN_API_KEY" },
];

export const LEVELS = [
  ["PushPilot affiliate", "Share links and ready-made ads. Earn per referral. No funnel training."],
  ["Creator", "Make ads and videos for mall businesses. Paid per piece."],
  ["Seed Loop member", "Test apps for points, push marketing, learn the funnel step by step, and train to help on cyber and AI-rules readiness checks for points or pay."],
  ["Entrepreneur", "Run your own campaigns, full funnel access, webinars."],
  ["Founder", "Everything above plus one-on-one strategy and guest spots."],
  ["Tech founder", "Everything above plus builds into the mall and white label."],
  ["Paying client", "Trellis Reach tiers: ads first, then email and phone, then the full system."],
];

// Which Hivecast path each community level signs up through. Used by the invite links.
export const LEVEL_PATHS: Record<string, string> = {
  "PushPilot affiliate": "creator", "Creator": "creator", "Seed Loop member": "builder", "Entrepreneur": "entre",
  "Founder": "entre", "Tech founder": "build", "Paying client": "client",
};

export const PROFILE_SLOTS: [string, string][] = [
  ["business_name", "Business"], ["app", "Which mall business"], ["audience", "Who it's for"],
  ["problem", "Their problem"], ["result", "Result they get"], ["proof", "Proof"],
  ["offer", "Offer"], ["cta", "Call to action"], ["mood", "Look and mood"],
];

// Who is calling. Used in every AI call opening, email footer and the opt-out page.
// Set COMPANY_PHONE (and optionally AI_CALLER_NAME) in Vercel to fill these in.
export const CALLER = {
  aiName: process.env.NEXT_PUBLIC_AI_CALLER_NAME || "Reach",
  company: "QVTrellis",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || "",
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || "qvtrellis@gmail.com",
  optOutUrl: (process.env.NEXT_PUBLIC_SITE_URL || "https://qvtrellis.net") + "/optout",
};
export const OPTED_OUT = "OPTED OUT";

// Exact consent wording. Saved with each lead (with the time) as proof of consent before any AI call.
export const CALL_CONSENT_TEXT =
  "I agree to get an AI-assisted phone call and texts at this number about the business I picked. The AI will tell me it's an AI, give me information about the business, answer my questions and can help me book a time. Consent isn't required to buy. I can opt out any time: press 1 on any AI call, reply STOP to texts, or visit qvtrellis.net/optout.";

export const CLIENT_SERVICES = [
  "AI phone calls to my leads", "AI booking", "AI email follow-up", "Ads and AI videos", "Hivecast funnel for my business",
  "Cyber & AI rules readiness check (CMMC, new AI laws)",
];
export const CLIENT_CONSENT_PROMISE =
  "My customers only get AI calls or texts after they agree first, through my Trellis Reach sign-up form or with written consent I can show. I won't upload lists of people who didn't agree.";

// Permission to test a client's systems and bots. Required before any readiness check.
export const READINESS_AUTH_TEXT =
  "I own these systems and bots or am authorized to approve testing them. I give QVTrellis permission to review and test them for the readiness check (security setup, exposed keys, and whether bots and AI do what they should). Nothing is tested until we agree in writing on exactly what's included and when. I can pause or cancel testing at any time.";

// The 4 ways to make an ad on the Create page.
export const MAKE_KINDS = [
  { id: "ai-ad", icon: "⚡", label: "AI Ad", hint: "Designed picture + words, all by AI", format: "Designed image ad" },
  { id: "ai-video", icon: "🎬", label: "AI Video", hint: "Premium commercial, made by AI", format: "30-second ad / commercial" },
  { id: "script", icon: "📝", label: "Script for you", hint: "You film it, your style", format: "Self-film video script" },
  { id: "creator", icon: "🎨", label: "Creator-made", hint: "A creator or you make it and upload", format: "Creator brief" },
] as const;

// Media release: anyone shown in an ad or video agrees to this before it's used.
export const RELEASE_TERMS = (who: string, business: string, products: string) =>
  `I, ${who || "[name]"}, give QVTrellis, ${business || "the business named"}, and the clients QVTrellis makes this ad or video for, permission to use my name, photo, image, likeness and voice, and images of ${products || "my business and products"}, in this ad or video and in future advertising and promotions, in any media (online, social, print, video), worldwide, without payment unless we agreed otherwise in writing. I confirm I'm 18 or older and have the right to give this permission for anything shown. I can ask to stop future use at any time by emailing ${CALLER.email}; content already published may stay up.`;

// Minor release: signed by a parent or legal guardian for anyone under 18.
export const MINOR_RELEASE_TERMS = (child: string, guardian: string, business: string, products: string) =>
  `I, ${guardian || "[parent or guardian]"}, am the parent or legal guardian of ${child || "[child's first name]"}, who is under 18. I give QVTrellis, ${business || "the business named"}, and the clients QVTrellis makes this ad or video for, permission to use my child's photo, image, likeness and voice, and images of ${products || "the products shown"}, in this ad or video and in future advertising and promotions, in any media, worldwide, without payment unless we agreed otherwise in writing. Only my child's first name may be used. Their last name, school, home address or location will never be shown. I can withdraw permission for future use at any time by emailing ${CALLER.email}; content already published may stay up, and we will remove it where we reasonably can. I confirm I'm 18 or older and have legal authority to sign for this child.`;
