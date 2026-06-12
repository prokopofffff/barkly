// Extract a YouTube video id from a pasted URL or a bare id (bk-jaz.9.2). Pure
// and dependency-free so it's unit-testable without yt-dlp or the network.
//
// A YouTube id is exactly 11 chars from [A-Za-z0-9_-]. We accept the common
// share forms a curator might paste — Shorts, youtu.be, watch?v=, embed — plus a
// bare id, and reject anything else (the caller turns null into a 400).

const ID = "[A-Za-z0-9_-]{11}";
const BARE_RE = new RegExp(`^${ID}$`);
const URL_PATTERNS: readonly RegExp[] = [
  new RegExp(`/shorts/(${ID})`, "i"), // youtube.com/shorts/<id>
  new RegExp(`youtu\\.be/(${ID})`, "i"), // youtu.be/<id>
  new RegExp(`[?&]v=(${ID})`, "i"), // youtube.com/watch?v=<id>
  new RegExp(`/embed/(${ID})`, "i"), // youtube.com/embed/<id>
  new RegExp(`/v/(${ID})`, "i"), // youtube.com/v/<id>
];

/** Return the 11-char video id from a URL or bare id, or null if none matches. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (BARE_RE.test(s)) return s;
  for (const re of URL_PATTERNS) {
    const m = re.exec(s);
    if (m?.[1]) return m[1];
  }
  return null;
}
