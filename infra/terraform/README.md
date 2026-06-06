# Infrastructure — Yandex Cloud (Terraform)

Provisions the base cloud infrastructure for Barkly / ГАВ:

| Resource | What it is |
|----------|-----------|
| `yandex_vpc_address.static` | Reserved **static public IPv4** address |
| `yandex_storage_bucket.media` | **S3-compatible Object Storage** bucket for media (private, versioned, encrypted) |
| `yandex_iam_service_account.storage` + static key | SA scoped to `storage.editor` that owns the bucket and provides S3 keys for the backend |

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
