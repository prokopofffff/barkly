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

## Remote state (S3 backend)

State lives in a dedicated **`barkly-tfstate`** Object Storage bucket (configured
in `versions.tf`) so local runs and CI share one state. Backend credentials come
from `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars — a static access key
scoped to that bucket (never committed).

For local validation without the backend: `terraform init -backend=false`.

> **`Invalid provider registry host` / can't reach `registry.terraform.io`?**
> From networks where HashiCorp's registry is blocked (e.g. RU), install the
> provider from Yandex's mirror. Create `~/.terraformrc`:
> ```hcl
> provider_installation {
>   network_mirror { url = "https://terraform-mirror.yandexcloud.net/" }
>   direct { exclude = ["registry.terraform.io/*/*"] }
> }
> ```
> then `terraform init -upgrade` (delete `.terraform.lock.hcl` first if it
> complains about hashes). CI runners reach the registry directly, so this is a
> local-only step.

> **`SignatureDoesNotMatch` on `terraform init`?** Two causes: (a) `AWS_ACCESS_KEY_ID`
> and `AWS_SECRET_ACCESS_KEY` are from different keys — re-export a matching pair
> (`yc iam access-key list --service-account-name barkly-ci` to check for dupes);
> (b) recent Terraform's aws-sdk sends checksum headers Yandex rejects — export
> `AWS_REQUEST_CHECKSUM_CALCULATION=when_required` and
> `AWS_RESPONSE_CHECKSUM_VALIDATION=when_required` (CI sets these automatically).

### Bootstrap the state bucket (one-time)

The state bucket must exist before the first `terraform init`. It is *not*
managed by this config (chicken-and-egg). Create it once with the `yc` CLI:

```bash
# 1. Service account that owns Terraform state + the static key for the backend.
yc iam service-account create --name barkly-tf-state
yc resource-manager folder add-access-binding --id "$(yc config get folder-id)" \
  --role storage.editor --subject "serviceAccount:$(yc iam service-account get barkly-tf-state --format json | jq -r .id)"

# 2. The state bucket.
yc storage bucket create --name barkly-tfstate

# 3. Static access key for the S3 backend (store the output as CI secrets).
yc iam access-key create --service-account-name barkly-tf-state
```

## CI/CD (GitHub Actions)

`.github/workflows/terraform.yml`:

- **Pull request** touching `infra/terraform/**` → `fmt -check`, `validate`,
  `plan`, and the plan is posted/updated as a PR comment.
- **Push to `main`** → `terraform apply -auto-approve`, gated on the
  **`production`** GitHub Environment (add required reviewers there for a manual
  approval step before anything is created/changed).

### Required configuration

Repository **Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Value |
|----------|-------|
| `YC_CLOUD_ID` | your cloud id |
| `YC_FOLDER_ID` | your folder id |
| `YC_CDN_CNAME` | *(optional)* CDN domain; leave unset to skip CDN |

Repository **Secrets**:

| Secret | What |
|--------|------|
| `YC_SA_KEY_JSON` | Authorized-key JSON of a CI service account with `editor` (or scoped) on the folder. Create: `yc iam key create --service-account-name <ci-sa> --output key.json` |
| `TF_STATE_S3_ACCESS_KEY` / `TF_STATE_S3_SECRET_KEY` | Static key for the `barkly-tfstate` bucket (from bootstrap step 3) |
| `PG_PASSWORD` | Password for the app DB user (`TF_VAR_pg_password`) |
| `WORKER_SSH_PUBLIC_KEY` | SSH public key installed on the ingestion worker |

The CI service account needs `editor` (or the union of `vpc.admin`,
`compute.admin`, `storage.admin`, `mdb.admin`, `iam.serviceAccounts.admin`) to
manage every resource here.

## Security notes

- `terraform.tfstate*`, `terraform.tfvars`, and `*.tfplan` are gitignored and
  contain secrets — never commit them.
- The media bucket is **private** (anonymous access off). Serve via signed URLs
  or the CDN origin, not public ACLs.
- Service accounts are least-privileged: `storage.editor` for the bucket/worker;
  the CI SA is the only broad one.

## Teardown

```bash
terraform destroy
```
