# --- Service account that owns the bucket and its S3 access keys ---------------

resource "yandex_iam_service_account" "storage" {
  name        = "${var.project}-storage-sa"
  description = "Owns the media Object Storage bucket and its static access keys."
}

# storage.admin (not editor) is required: Terraform configures bucket-level
# settings (versioning, CORS, lifecycle, policy) via the S3 API, and those
# operations are denied to storage.editor.
resource "yandex_resourcemanager_folder_iam_member" "storage_admin" {
  folder_id = var.folder_id
  role      = "storage.admin"
  member    = "serviceAccount:${yandex_iam_service_account.storage.id}"
}

# AWS-style static key pair used both by Terraform (to create the bucket) and by
# the backend app to read/write media. Secret is only ever available here + state.
resource "yandex_iam_service_account_static_access_key" "storage" {
  service_account_id = yandex_iam_service_account.storage.id
  description        = "Static access key for ${var.media_bucket_name}"
}

# --- The media bucket ----------------------------------------------------------

resource "yandex_storage_bucket" "media" {
  access_key = yandex_iam_service_account_static_access_key.storage.access_key
  secret_key = yandex_iam_service_account_static_access_key.storage.secret_key

  bucket   = var.media_bucket_name
  max_size = var.media_bucket_max_size

  # Private: no anonymous access. Serve media via signed URLs or a CDN origin.
  anonymous_access_flags {
    read        = false
    list        = false
    config_read = false
  }

  versioning {
    enabled = true
  }

  # Browser uploads from the Expo app / web client.
  cors_rule {
    allowed_methods = ["GET", "HEAD", "PUT", "POST"]
    allowed_origins = ["*"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }

  # Object Storage encrypts data at rest at the platform level. For customer-managed
  # keys, add a `yandex_kms_symmetric_key` + `server_side_encryption_configuration`
  # (requires granting the SA `kms.keys.encrypterDecrypter`).

  # IAM binding must exist before the SA can create the bucket.
  depends_on = [yandex_resourcemanager_folder_iam_member.storage_admin]
}
