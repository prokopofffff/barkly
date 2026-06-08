import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Thin yt-dlp wrapper for discovery (bk-z5t.4) — no YouTube Data API, no key,
// no quota. The subprocess call is isolated from the pure parsers below so the
// parsing is unit-testable without yt-dlp or the network.

const execFileAsync = promisify(execFile);

const YTDLP_BIN = process.env.YTDLP_BIN ?? "yt-dlp";
// A channel /shorts tab can list hundreds of entries; default 1 MiB is too small.
const MAX_BUFFER = 256 * 1024 * 1024;

export type ShortEntry = {
  readonly id: string; // YouTube video id
  readonly title: string;
  readonly durationS: number | null; // often null in flat mode; confirmed later
  readonly views: number | null;
};

export type ChannelShorts = {
  readonly channelId: string | null; // canonical UC… id
  readonly channelTitle: string | null;
  readonly entries: readonly ShortEntry[];
};

/** Build the /shorts tab URL for a handle (@name), bare name, or UC… id. */
export function channelShortsUrl(handle: string): string {
  if (/^UC[\w-]{22}$/.test(handle)) {
    return `https://www.youtube.com/channel/${handle}/shorts`;
  }
  const h = handle.startsWith("@") ? handle : `@${handle}`;
  return `https://www.youtube.com/${h}/shorts`;
}

/** Run yt-dlp; return stdout. Throws with stderr context on non-zero exit. */
export async function runYtDlp(args: readonly string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(YTDLP_BIN, [...args], {
      maxBuffer: MAX_BUFFER,
    });
    return stdout;
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    throw new Error(
      `yt-dlp failed (${args.join(" ")}): ${e.stderr?.trim() || e.message}`,
      { cause: err },
    );
  }
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Parse the JSON from `yt-dlp --flat-playlist -J <channel>/shorts`. Tolerant
 * of missing fields and null entries (yt-dlp emits those with --ignore-errors). */
export function parseChannelShorts(json: string): ChannelShorts {
  const root = JSON.parse(json) as {
    channel_id?: unknown;
    channel?: unknown;
    uploader?: unknown;
    title?: unknown;
    entries?: unknown;
  };

  const rawEntries = Array.isArray(root.entries) ? root.entries : [];
  const entries: ShortEntry[] = [];
  for (const raw of rawEntries) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const id = asString(e.id);
    if (!id) continue;
    entries.push({
      id,
      title: asString(e.title) ?? "",
      durationS: asNumber(e.duration),
      views: asNumber(e.view_count),
    });
  }

  return {
    channelId: asString(root.channel_id),
    channelTitle:
      asString(root.channel) ?? asString(root.uploader) ?? asString(root.title),
    entries,
  };
}

/** Enumerate a channel's Shorts (flat — ids + light metadata, cheap). */
export async function fetchChannelShorts(
  handle: string,
  limit: number,
): Promise<ChannelShorts> {
  const out = await runYtDlp([
    "--flat-playlist",
    "-J",
    "--playlist-end",
    String(limit),
    "--no-warnings",
    "--ignore-errors",
    channelShortsUrl(handle),
  ]);
  return parseChannelShorts(out);
}

// --- full single-video metadata (the pre-filter / download input) ------------

export type VideoMeta = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly durationS: number | null;
  readonly uploadDate: string | null; // YYYYMMDD as yt-dlp reports it
  readonly tags: readonly string[]; // usually empty via yt-dlp
  readonly views: number | null;
  readonly likes: number | null;
  readonly comments: number | null;
  readonly language: string | null; // yt-dlp's guess, when present
  readonly manualCaptionLangs: readonly string[]; // creator-uploaded captions
  readonly autoCaptionLangs: readonly string[]; // ASR captions
};

export function watchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

function langKeys(v: unknown): string[] {
  return v && typeof v === "object" ? Object.keys(v as object) : [];
}

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Parse the JSON from `yt-dlp -J <video>` into normalized metadata. */
export function parseVideoMeta(json: string): VideoMeta {
  const r = JSON.parse(json) as Record<string, unknown>;
  return {
    id: asString(r.id) ?? "",
    title: asString(r.title) ?? "",
    description: asString(r.description) ?? "",
    durationS: asNumber(r.duration),
    uploadDate: asString(r.upload_date),
    tags: stringArray(r.tags),
    views: asNumber(r.view_count),
    likes: asNumber(r.like_count),
    comments: asNumber(r.comment_count),
    language: asString(r.language),
    manualCaptionLangs: langKeys(r.subtitles),
    autoCaptionLangs: langKeys(r.automatic_captions),
  };
}

/** Fetch full metadata for a single video (no download). */
export async function fetchVideoMeta(id: string): Promise<VideoMeta> {
  const out = await runYtDlp([
    "-J",
    "--no-playlist",
    "--no-warnings",
    watchUrl(id),
  ]);
  return parseVideoMeta(out);
}
