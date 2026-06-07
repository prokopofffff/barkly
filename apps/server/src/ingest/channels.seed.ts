// Curated allowlist of source channels for the ingestion pipeline (bk-z5t.3).
//
// STARTER LIST — hand-picked, English-speaking, safe (educational / lifestyle),
// known to post Shorts. Handles are resolved to canonical channel ids at
// discovery time (bk-z5t.4): any handle that doesn't resolve is reported and
// skipped, so an imperfect handle here is non-fatal. Curate freely.
//
// We exclude news / political / military / socio-political channels at the
// SOURCE — that is the strongest safety lever (defense-in-depth: allowlist ->
// keyword denylist -> LLM -> sampled human review). Genres that tend to drift
// political/edgy (street interviews, some "funny"/relationship channels) carry
// lower trust and notes; the LLM gate still inspects every clip.
//
// trust: 0-3 curator confidence (3 = built for learners, safest).

export type ChannelTopic =
  | "daily_life"
  | "travel"
  | "food"
  | "shopping"
  | "productivity"
  | "technology"
  | "study_tips"
  | "street_interviews"
  | "funny_conversations"
  | "workplace_conversations"
  | "relationship_conversations"
  | "movies_tv"
  | "english_learning";

export type ChannelSeed = {
  readonly handle: string; // @handle or a UC… channel id
  readonly topic: ChannelTopic;
  readonly trust: number; // 0-3
  readonly notes?: string;
};

export const channelSeed: readonly ChannelSeed[] = [
  // --- English-learning channels (on-mission, clearest, safest) -------------
  { handle: "@BBCLearningEnglish", topic: "english_learning", trust: 3 },
  { handle: "@EnglishWithLucy", topic: "english_learning", trust: 3 },
  { handle: "@mmmEnglish", topic: "english_learning", trust: 3 },
  { handle: "@SpeakEnglishWithVanessa", topic: "english_learning", trust: 3 },
  { handle: "@EnglishClass101", topic: "english_learning", trust: 3 },

  // --- Technology / reviews -------------------------------------------------
  { handle: "@mkbhd", topic: "technology", trust: 2 },
  { handle: "@Mrwhosetheboss", topic: "technology", trust: 2 },
  { handle: "@UrAvgConsumer", topic: "technology", trust: 2 },

  // --- Productivity / study tips --------------------------------------------
  { handle: "@aliabdaal", topic: "productivity", trust: 2 },
  { handle: "@mattdavella", topic: "productivity", trust: 2 },
  {
    handle: "@ThomasFrankExplains",
    topic: "study_tips",
    trust: 2,
    notes: "verify handle",
  },

  // --- Food / cooking (explanatory, clear English) --------------------------
  { handle: "@JoshuaWeissman", topic: "food", trust: 2 },
  { handle: "@aragusea", topic: "food", trust: 2 },
  { handle: "@EthanChlebowski", topic: "food", trust: 2 },

  // --- Travel ---------------------------------------------------------------
  {
    handle: "@drewbinsky",
    topic: "travel",
    trust: 2,
    notes: "slow, clear speech — good for learners",
  },
  { handle: "@yestheory", topic: "travel", trust: 2 },
  { handle: "@KaraandNate", topic: "travel", trust: 2 },

  // --- Daily life / vlogs ---------------------------------------------------
  {
    handle: "@caseyneistat",
    topic: "daily_life",
    trust: 1,
    notes: "fast speech — advanced level",
  },

  // --- Workplace / corporate humor (clean skits) ----------------------------
  { handle: "@CorporateNatalie", topic: "workplace_conversations", trust: 2 },
  {
    handle: "@corporate.bro",
    topic: "workplace_conversations",
    trust: 1,
    notes: "verify handle",
  },

  // --- Relationship (coaching, no sexual content) ---------------------------
  {
    handle: "@matthewhussey",
    topic: "relationship_conversations",
    trust: 1,
    notes: "relationship coaching — LLM gate must confirm no sexual content",
  },

  // --- Movies / TV clips ----------------------------------------------------
  {
    handle: "@TED",
    topic: "movies_tv",
    trust: 3,
    notes: "talks — excellent clear English, very safe",
  },
  {
    handle: "@RyanGeorge",
    topic: "movies_tv",
    trust: 2,
    notes: "Pitch Meeting — clean, clear comedic English; verify handle",
  },

  // --- Funny conversations (clean comedy) -----------------------------------
  {
    handle: "@CalebCity",
    topic: "funny_conversations",
    trust: 1,
    notes: "comedy skits — LLM gate must confirm clean; verify handle",
  },

  // NOTE: street_interviews is intentionally left for hand-curation. The genre
  // drifts into socio-political / dating content; pick specific safe channels
  // by hand rather than auto-seeding.
];
