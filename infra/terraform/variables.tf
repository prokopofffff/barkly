variable "yc_token" {
  description = "Yandex Cloud OAuth/IAM token. If empty, the provider falls back to the YC_TOKEN env var or the `yc` CLI credentials."
  type        = string
  default     = ""
  sensitive   = true
}

variable "cloud_id" {
  description = "Yandex Cloud cloud ID (yc config get cloud-id)."
  type        = string
}

variable "folder_id" {
  description = "Yandex Cloud folder ID (yc config get folder-id)."
  type        = string
}

variable "zone" {
  description = "Default availability zone."
  type        = string
  default     = "ru-central1-a"
}

variable "region" {
  description = "Object Storage region."
  type        = string
  default     = "ru-central1"
}

variable "project" {
  description = "Short project slug used to name/prefix resources."
  type        = string
  default     = "barkly"
}

variable "media_bucket_name" {
  description = "Globally-unique name for the media Object Storage bucket."
  type        = string
  default     = "barkly-media"
}

variable "media_bucket_max_size" {
  description = "Max bucket size in bytes (0 = unlimited). Default 50 GiB to cap surprise costs."
  type        = number
  default     = 53687091200
}
