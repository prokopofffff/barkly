terraform {
  required_version = ">= 1.6"

  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = ">= 0.115"
    }
  }

  # Remote state in a dedicated Object Storage bucket so CI (plan on PR, apply on
  # merge) shares one state. Credentials come from AWS_ACCESS_KEY_ID /
  # AWS_SECRET_ACCESS_KEY env vars (a static access key for the state bucket) —
  # never hard-code them here. The state bucket is created once during bootstrap
  # (see README "Bootstrap the state bucket"), separate from the media bucket.
  backend "s3" {
    endpoints = { s3 = "https://storage.yandexcloud.net" }
    bucket    = "barkly-tfstate"
    region    = "ru-central1"
    key       = "infra/terraform.tfstate"

    skip_region_validation      = true
    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    skip_metadata_api_check     = true
  }
}
