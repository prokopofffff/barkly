import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "@/lib/config";

// Yandex Object Storage adapter (S3-compatible). The media bucket is PRIVATE
// (anonymous access off) — we never expose public ACLs; reads go through a
// presigned URL (or the CDN origin in front of the same bucket).
//
// Auth: AWS-style static access keys (HMAC SigV4). On the Compute worker the
// attached service account authenticates the `yc` CLI / native API via the
// metadata token, but the S3 endpoint still requires static keys — provision
// them into the worker's env (e.g. from `terraform output -raw storage_*`).

// Object key layout in the bucket. `ytId` is the YouTube video id.
export const mediaKeys = {
  raw: (ytId: string) => `raw/${ytId}.mp4`,
  mp4: (ytId: string) => `mp4/${ytId}/720p.mp4`,
  poster: (ytId: string) => `posters/${ytId}.jpg`,
  sub: (ytId: string, lang: string) => `subs/${ytId}.${lang}.vtt`,
} as const;

type S3Config = {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function requireS3(): S3Config {
  const { S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = config;
  if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error(
      "Object Storage is not configured: set S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY",
    );
  }
  return {
    bucket: S3_BUCKET,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  };
}

let cached: { client: S3Client; bucket: string } | null = null;

function s3(): { client: S3Client; bucket: string } {
  if (cached) return cached;
  const { bucket, accessKeyId, secretAccessKey } = requireS3();
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    credentials: { accessKeyId, secretAccessKey },
    // Yandex serves virtual-hosted-style (bucket.storage.yandexcloud.net).
    forcePathStyle: false,
    // Yandex's S3 rejects the checksum headers recent AWS SDKs send by default
    // (SignatureDoesNotMatch / 400). Only send them when strictly required.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  cached = { client, bucket };
  return cached;
}

export async function putObject(
  key: string,
  body: Uint8Array | Buffer | string,
  contentType?: string,
): Promise<void> {
  const { client, bucket } = s3();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function objectExists(key: string): Promise<boolean> {
  const { client, bucket } = s3();
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "NotFound" || err.name === "NoSuchKey")
    ) {
      return false;
    }
    throw err;
  }
}

// Presigned GET URL for private serving. Default TTL 1h; cap callers to sane
// lifetimes so links don't leak indefinitely.
export async function presignGet(
  key: string,
  ttlSeconds = 3600,
): Promise<string> {
  const { client, bucket } = s3();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: ttlSeconds },
  );
}
