terraform {
  required_version = ">= 1.6"

  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = ">= 0.115"
    }
  }

  # Remote state lives in the very bucket this config creates, so the backend is
  # commented out for the first `apply`. After the bucket exists, fill in the
  # access/secret keys (see README "Remote state") and run `terraform init -migrate-state`.
  #
  # backend "s3" {
  #   endpoints = { s3 = "https://storage.yandexcloud.net" }
  #   bucket    = "barkly-tfstate"
  #   region    = "ru-central1"
  #   key       = "infra/terraform.tfstate"
  #
  #   skip_region_validation      = true
  #   skip_credentials_validation = true
  #   skip_requesting_account_id  = true
  #   skip_s3_checksum            = true
  # }
}
