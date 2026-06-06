# Infrastructure — Yandex Cloud (Terraform)

Provisions the cloud infrastructure for Barkly / ГАВ:

| Service | Resource(s) | What it is |
|---------|-------------|-----------|
| **Object Storage** | `yandex_storage_bucket.media` (+ storage SA + static key) | S3-compatible bucket for video/subs/posters (private, versioned, CORS) |
| **VPC** | `yandex_vpc_network` / `_subnet` / `_address.static` / 2× `_security_group` | Network, subnet, reserved static public IPv4, firewall rules |
| **Compute Cloud** | `yandex_compute_instance.worker` (+ worker SA) | Ingestion worker (yt-dlp + **ffmpeg**), gets the static IP, SA-auth to the bucket |
| **Managed PostgreSQL** | `yandex_mdb_postgresql_cluster.main` (+ db + user) | Postgres + Zero sync; logical replication on by default, `mdb_replication` user |
| **Cloud CDN** | `yandex_cdn_resource` / `_origin_group` | Media delivery in front of the bucket — **opt-in** (set `cdn_cname`) |

> **No managed transcoder.** Yandex has no AWS-MediaConvert equivalent that writes
> HLS back to your bucket (Yandex Cloud Video is a closed hosting platform). So
> ffmpeg runs in the Compute worker, next to yt-dlp.

Docs: https://yandex.cloud/en/docs/terraform/

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.6 (have v1.14.5)
- [`yc` CLI](https://yandex.cloud/en/docs/cli/) authenticated (`yc init`) — already configured here
- A billing account linked to the cloud

## Usage

```bash
cd infra/terraform

cp terraform.tfvars.example terraform.tfvars   # values prefilled from `yc config`

terraform init       # downloads the yandex provider
terraform plan        # review what will be created
terraform apply       # create the resources
```

Authentication: by default the provider uses the `yc` CLI / `YC_TOKEN` env var.
To pin an explicit token instead, set `yc_token` in `terraform.tfvars` (sensitive).

## Outputs

```bash
terraform output static_ip_address          # the reserved public IP
terraform output media_bucket_name
terraform output -raw storage_access_key     # S3 access key id  (sensitive)
terraform output -raw storage_secret_key     # S3 secret key     (sensitive)
```

Wire the bucket into `apps/server` (S3-compatible, AWS SDK works):

```
S3_ENDPOINT=https://storage.yandexcloud.net
S3_REGION=ru-central1
S3_BUCKET=barkly-media
S3_ACCESS_KEY_ID=<terraform output -raw storage_access_key>
S3_SECRET_ACCESS_KEY=<terraform output -raw storage_secret_key>
```

## Per-service notes

- **Compute worker** — set `ssh_public_key_path` to a key you hold; you log in as
  `barkly@<static-ip>`. cloud-init installs `ffmpeg`, `yt-dlp`, and `yc`. The
  instance authenticates to the bucket via its attached service account (IAM
  token from metadata) — no S3 keys on the box.
- **Managed PostgreSQL** — `pg_password` is **required** for apply (set it in
  `terraform.tfvars`). Connect via `terraform output pg_connection_uri`
  (port 6432, `sslmode=require`). Logical replication is on by default; the app
  user has `mdb_replication` for Zero's CDC. Keep `pg_public_access = false`
  unless you need to reach it from outside the VPC.
- **Cloud CDN** — disabled until you set `cdn_cname` to a domain you control.
  Before the first apply with CDN: activate the provider once
  (Console → CDN → "Connect CDN provider"), then point a DNS CNAME at the CDN.

## Remote state (recommended, after first apply)

State currently lives in a **local** `terraform.tfstate` and contains the S3
secret key — it is gitignored. To move state into the bucket itself:

1. Uncomment the `backend "s3"` block in `versions.tf` (adjust `bucket`/`key`).
2. Create AWS-style env vars from the static key:
   ```bash
   export AWS_ACCESS_KEY_ID=$(terraform output -raw storage_access_key)
   export AWS_SECRET_ACCESS_KEY=$(terraform output -raw storage_secret_key)
   ```
3. `terraform init -migrate-state`

## Security notes

- `terraform.tfstate`, `terraform.tfvars`, and `.tfplan` files are gitignored —
  they contain secrets. Never commit them.
- The bucket is **private** (`acl = "private"`, anonymous access off). Serve
  media via signed URLs or a CDN origin, not public ACLs.
- The service account is scoped to `storage.editor` on this folder only.

## Teardown

```bash
terraform destroy
```
