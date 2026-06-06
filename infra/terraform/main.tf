provider "yandex" {
  # token is optional: leave var.yc_token empty to use the YC_TOKEN env var or
  # the credentials already configured in the `yc` CLI.
  token     = var.yc_token != "" ? var.yc_token : null
  cloud_id  = var.cloud_id
  folder_id = var.folder_id
  zone      = var.zone
}

locals {
  labels = {
    project    = var.project
    managed_by = "terraform"
  }
}
