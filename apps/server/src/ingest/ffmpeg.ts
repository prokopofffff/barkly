import { execFile } from "node:child_process";
import { promisify } from "node:util";

// ffmpeg wrapper for the transcode step (bk-z5t.6). Pure arg builders are
// separated from the subprocess call so they can be unit-tested without ffmpeg.

const execFileAsync = promisify(execFile);
const FFMPEG_BIN = process.env.FFMPEG_BIN ?? "ffmpeg";

// Transcode to a mobile feed rendition: fit inside a 720x1280 box (downscale
// only, preserve aspect, even dimensions), H.264 main/yuv420p for universal
// device playback, and +faststart so the moov atom is at the front (instant
// start on progressive download).
export function transcodeArgs(input: string, output: string): string[] {
  return [
    "-i",
    input,
    "-vf",
    "scale=w=720:h=1280:force_original_aspect_ratio=decrease:force_divisible_by=2",
    "-c:v",
    "libx264",
    "-profile:v",
    "main",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "23",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-y",
    output,
  ];
}

// Grab a poster frame ~1s in (avoids a black first frame) for the instant
// thumbnail while the video buffers.
export function posterArgs(input: string, output: string): string[] {
  return ["-ss", "1", "-i", input, "-frames:v", "1", "-q:v", "3", "-y", output];
}

async function runFfmpeg(args: string[]): Promise<void> {
  try {
    await execFileAsync(FFMPEG_BIN, ["-hide_banner", "-loglevel", "error", ...args]);
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    throw new Error(`ffmpeg failed: ${e.stderr?.trim() || e.message}`, {
      cause: err,
    });
  }
}

export function transcode(input: string, output: string): Promise<void> {
  return runFfmpeg(transcodeArgs(input, output));
}

export function poster(input: string, output: string): Promise<void> {
  return runFfmpeg(posterArgs(input, output));
}
