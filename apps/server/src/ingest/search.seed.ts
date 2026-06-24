import type { ChannelTopic } from "@/ingest/channels.seed";

// Curated search queries for keyless ytsearch discovery (bk-44m). Each query is
// tagged with one of the SAFE topics; the topic is recorded on the discovered
// channel so the rest of the pipeline (and any later curation) can reason about
// it. Search only WIDENS the candidate pool — the same defense-in-depth still
// applies to every hit: keyword denylist -> Haiku classify gate (rejects
// politics/war/sexual/hate) -> sampled human review.
//
// We deliberately exclude news / political / military / socio-political angles
// here (no such queries) AND the classify gate drops any that slip through.
// Queries lean toward natural, spoken, everyday English (best for learners) and
// bias toward Shorts; non-Shorts get dropped by the prefilter duration gate.

export type SearchQuery = {
  readonly query: string;
  readonly topic: ChannelTopic;
};

export const searchSeed: readonly SearchQuery[] = [
  // --- daily life -----------------------------------------------------------
  { query: "daily english conversation shorts", topic: "daily_life" },
  { query: "everyday english small talk shorts", topic: "daily_life" },
  { query: "real life english dialogue shorts", topic: "daily_life" },

  // --- travel ---------------------------------------------------------------
  { query: "travel vlog english shorts", topic: "travel" },
  { query: "airport hotel english phrases shorts", topic: "travel" },
  { query: "backpacking travel english shorts", topic: "travel" },

  // --- food / cooking -------------------------------------------------------
  { query: "cooking recipe english shorts", topic: "food" },
  { query: "street food review english shorts", topic: "food" },
  { query: "restaurant ordering english shorts", topic: "food" },

  // --- shopping -------------------------------------------------------------
  { query: "shopping haul english shorts", topic: "shopping" },
  { query: "grocery shopping english conversation shorts", topic: "shopping" },

  // --- productivity ---------------------------------------------------------
  { query: "productivity tips shorts english", topic: "productivity" },
  { query: "morning routine english shorts", topic: "productivity" },

  // --- technology -----------------------------------------------------------
  { query: "tech review shorts english", topic: "technology" },
  { query: "gadget unboxing english shorts", topic: "technology" },

  // --- study tips -----------------------------------------------------------
  { query: "study tips english learners shorts", topic: "study_tips" },
  { query: "how to learn english shorts", topic: "study_tips" },

  // --- street interviews ----------------------------------------------------
  { query: "street interview english shorts", topic: "street_interviews" },
  { query: "asking strangers english questions shorts", topic: "street_interviews" },

  // --- funny conversations --------------------------------------------------
  { query: "funny english conversation skit shorts", topic: "funny_conversations" },
  { query: "comedy sketch everyday english shorts", topic: "funny_conversations" },

  // --- workplace conversations ----------------------------------------------
  { query: "office english conversation shorts", topic: "workplace_conversations" },
  { query: "business english meeting phrases shorts", topic: "workplace_conversations" },

  // --- relationship conversations -------------------------------------------
  { query: "friends conversation english shorts", topic: "relationship_conversations" },
  { query: "dating english phrases shorts", topic: "relationship_conversations" },

  // --- movies / series / TV clips -------------------------------------------
  { query: "movie scene english learning shorts", topic: "movies_tv" },
  { query: "tv series english dialogue shorts", topic: "movies_tv" },
  { query: "sitcom clip english subtitles shorts", topic: "movies_tv" },
];
